/**
 * Provision / manage web-UI users (calcifer-7c3a.6).
 *
 * The web channel authenticates a browser to a nanoclaw user `web:<handle>`,
 * whose own messaging group (`web:<handle>`) is wired to one agent group. This
 * script is the owner-only provisioning surface — there is deliberately no open
 * signup, so an exposed instance can't be used to mint accounts.
 *
 * Runs alongside the live service (central DB is WAL-mode; no adapter init here,
 * so no Gateway conflict). New logins work immediately; a running container only
 * needs a fresh session for a brand-new messaging group, which happens on the
 * user's first message.
 *
 * Usage:
 *   pnpm exec tsx scripts/web-user.ts add \
 *     --handle joel --display-name "Joel" \
 *     --agent-group <AGENT_GROUP_ID> \
 *     [--role owner|admin|member]        # default: member
 *     ( --password <pw> | --password-stdin | --generate )
 *
 *   pnpm exec tsx scripts/web-user.ts set-password --handle joel ( --password <pw> | --password-stdin | --generate )
 *   pnpm exec tsx scripts/web-user.ts list
 *   pnpm exec tsx scripts/web-user.ts remove --handle joel   # disables login (keeps threads)
 */
import crypto from 'crypto';
import path from 'path';

import { hashPassword, upsertCredential, deleteCredential, getCredential } from '../src/channels/web-auth.js';
import { DATA_DIR } from '../src/config.js';
import { getAgentGroup, getAllAgentGroups } from '../src/db/agent-groups.js';
import { initDb } from '../src/db/connection.js';
import {
  createMessagingGroup,
  createMessagingGroupAgent,
  getMessagingGroupAgentByPair,
  getMessagingGroupByPlatform,
} from '../src/db/messaging-groups.js';
import { runMigrations } from '../src/db/migrations/index.js';
import { addMember } from '../src/modules/permissions/db/agent-group-members.js';
import { getUserRoles, grantRole } from '../src/modules/permissions/db/user-roles.js';
import { getAllUsers, getUser, upsertUser } from '../src/modules/permissions/db/users.js';
import type { AgentGroup } from '../src/types.js';

type Role = 'owner' | 'admin' | 'member';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[name] = true;
    } else {
      out[name] = next;
      i++;
    }
  }
  return out;
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data.trim()));
  });
}

async function resolvePassword(
  flags: Record<string, string | boolean>,
): Promise<{ password: string; generated: boolean }> {
  if (typeof flags.password === 'string') return { password: flags.password, generated: false };
  if (flags['password-stdin']) return { password: await readStdin(), generated: false };
  if (flags.generate) {
    // 18 bytes → ~24 base64url chars. Strong, human-transcribable enough.
    return { password: crypto.randomBytes(18).toString('base64url'), generated: true };
  }
  console.error('Provide a password: --password <pw>, --password-stdin, or --generate');
  process.exit(2);
}

function requireHandle(flags: Record<string, string | boolean>): string {
  const handle = typeof flags.handle === 'string' ? flags.handle.trim().toLowerCase() : '';
  if (!handle || !/^[a-z0-9._-]+$/.test(handle)) {
    console.error('--handle is required and must be [a-z0-9._-]+ (lowercased).');
    process.exit(2);
  }
  return handle;
}

async function cmdAdd(flags: Record<string, string | boolean>): Promise<void> {
  const handle = requireHandle(flags);
  const userId = `web:${handle}`;
  const platformId = `web:${handle}`;
  const displayName = typeof flags['display-name'] === 'string' ? (flags['display-name'] as string) : handle;
  const role: Role = ((): Role => {
    const r = typeof flags.role === 'string' ? flags.role.toLowerCase() : 'member';
    if (r !== 'owner' && r !== 'admin' && r !== 'member') {
      console.error('--role must be owner, admin, or member');
      process.exit(2);
    }
    return r;
  })();

  // Resolve the agent group (must already exist — create it with the normal
  // agent tooling first, then point a web user at it).
  const agentGroupId = typeof flags['agent-group'] === 'string' ? (flags['agent-group'] as string) : '';
  if (!agentGroupId) {
    console.error('--agent-group <id> is required. Available agent groups:');
    for (const ag of getAllAgentGroups()) console.error(`  ${ag.id}  ${ag.name}`);
    process.exit(2);
  }
  const ag: AgentGroup | undefined = getAgentGroup(agentGroupId);
  if (!ag) {
    console.error(`Agent group not found: ${agentGroupId}`);
    process.exit(2);
  }

  const { password, generated } = await resolvePassword(flags);
  const now = new Date().toISOString();

  // 1. User row.
  upsertUser({ id: userId, kind: 'web', display_name: displayName, created_at: now });

  // 2. Role + membership.
  const roles = getUserRoles(userId);
  if (role === 'owner' && !roles.some((r) => r.role === 'owner' && r.agent_group_id === null)) {
    grantRole({ user_id: userId, role: 'owner', agent_group_id: null, granted_by: null, granted_at: now });
  } else if (role === 'admin' && !roles.some((r) => r.role === 'admin' && r.agent_group_id === ag.id)) {
    grantRole({ user_id: userId, role: 'admin', agent_group_id: ag.id, granted_by: null, granted_at: now });
  }
  // Always add a membership row so the access gate passes for plain members too.
  addMember({ user_id: userId, agent_group_id: ag.id, added_by: null, added_at: now });

  // 3. Per-user messaging group.
  let mg = getMessagingGroupByPlatform('web', platformId);
  if (!mg) {
    createMessagingGroup({
      id: generateId('mg'),
      channel_type: 'web',
      platform_id: platformId,
      name: displayName,
      is_group: 1,
      // Only the authenticated user (a member/owner) can reach this group.
      unknown_sender_policy: 'strict',
      created_at: now,
    });
    mg = getMessagingGroupByPlatform('web', platformId)!;
    console.log(`Created messaging group ${mg.id} (${platformId})`);
  } else {
    console.log(`Reusing messaging group ${mg.id} (${platformId})`);
  }

  // 4. Wire it to the agent group — per-thread sessions, respond to everything.
  if (!getMessagingGroupAgentByPair(mg.id, ag.id)) {
    createMessagingGroupAgent({
      id: generateId('mga'),
      messaging_group_id: mg.id,
      agent_group_id: ag.id,
      engage_mode: 'pattern',
      engage_pattern: '.',
      sender_scope: 'all',
      ignored_message_policy: 'drop',
      session_mode: 'per-thread',
      priority: 0,
      created_at: now,
    });
    console.log(`Wired ${mg.id} -> ${ag.id} (per-thread)`);
  } else {
    console.log(`Wiring already exists: ${mg.id} -> ${ag.id}`);
  }

  // 5. Credential.
  upsertCredential(userId, hashPassword(password));

  console.log('');
  console.log('Web user provisioned.');
  console.log(`  user:   ${userId} (${role})`);
  console.log(`  agent:  ${ag.name} [${ag.id}]`);
  console.log(`  login:  handle "${handle}"`);
  if (generated) console.log(`  password (store securely, rotate later): ${password}`);
  console.log('');
  console.log('Log in at the web UI with that handle + password.');
}

async function cmdSetPassword(flags: Record<string, string | boolean>): Promise<void> {
  const handle = requireHandle(flags);
  const userId = `web:${handle}`;
  if (!getUser(userId)) {
    console.error(`No such user: ${userId}. Run "add" first.`);
    process.exit(2);
  }
  const { password, generated } = await resolvePassword(flags);
  upsertCredential(userId, hashPassword(password));
  console.log(`Password updated for ${userId}.`);
  if (generated) console.log(`  new password: ${password}`);
}

function cmdRemove(flags: Record<string, string | boolean>): void {
  const handle = requireHandle(flags);
  const userId = `web:${handle}`;
  if (!getCredential(userId)) {
    console.error(`No credential for ${userId} (already disabled or never provisioned).`);
    process.exit(2);
  }
  deleteCredential(userId);
  console.log(`Login disabled for ${userId}. Their user/messaging-group/threads are left intact.`);
}

function cmdList(): void {
  const webUsers = getAllUsers().filter((u) => u.id.startsWith('web:'));
  if (webUsers.length === 0) {
    console.log('No web users provisioned.');
    return;
  }
  for (const u of webUsers) {
    const hasCred = getCredential(u.id) ? 'login-enabled' : 'login-disabled';
    console.log(`${u.id}\t${u.display_name ?? ''}\t${hasCred}`);
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  const db = initDb(path.join(DATA_DIR, 'v2.db'));
  runMigrations(db); // idempotent — ensures web_credentials exists

  switch (cmd) {
    case 'add':
      await cmdAdd(flags);
      break;
    case 'set-password':
      await cmdSetPassword(flags);
      break;
    case 'remove':
      cmdRemove(flags);
      break;
    case 'list':
      cmdList();
      break;
    default:
      console.error('Usage: web-user.ts <add|set-password|remove|list> [flags] — see file header.');
      process.exit(2);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
