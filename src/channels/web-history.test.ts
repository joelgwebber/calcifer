import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initTestDb, closeDb, runMigrations, createAgentGroup } from '../db/index.js';
import { createMessagingGroup, createMessagingGroupAgent } from '../db/messaging-groups.js';
import { createSession } from '../db/sessions.js';
import { setThreadTitle } from '../db/thread-meta.js';
import { createUser } from '../modules/permissions/db/users.js';
import { peerThreadId, systemThreadId } from '../correspondent.js';
import { listThreads } from './web-history.js';

function now(): string {
  return new Date().toISOString();
}

/**
 * calcifer-bd2f: a durable per-correspondent web thread is titled by WHO it's
 * with, derived from its `peer:<ag>` / `sys:<source>` thread_id — not its first
 * message (a correspondent thread's first turn is the agent surfacing, or a
 * user reply that isn't the thread's name).
 */
describe('web-history correspondent labels (calcifer-bd2f)', () => {
  // Recipient (Anaïs) — the web user whose thread list we read.
  const RCPT = 'ag-anais';
  const MG_RCPT = 'mg-web-anais';
  // Peer (Joel) — the correspondent behind the relay.
  const PEER = 'ag-joel';
  const MG_PEER = 'mg-web-joel';

  async function wire(mgId: string, platformId: string, agentGroupId: string): Promise<void> {
    await createMessagingGroup({
      id: mgId,
      channel_type: 'web',
      platform_id: platformId,
      name: platformId,
      is_group: 0,
      unknown_sender_policy: 'public',
      created_at: now(),
    });
    await createMessagingGroupAgent({
      id: `mga-${mgId}`,
      messaging_group_id: mgId,
      agent_group_id: agentGroupId,
      engage_mode: 'pattern',
      engage_pattern: '.',
      sender_scope: 'all',
      ignored_message_policy: 'drop',
      session_mode: 'per-thread',
      priority: 0,
      created_at: now(),
    });
  }

  beforeEach(async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await createAgentGroup({
      id: RCPT,
      name: 'Calcifer',
      folder: 'dm-with-anais',
      agent_provider: null,
      created_at: now(),
    });
    await createAgentGroup({
      id: PEER,
      name: 'Calcifer',
      folder: 'dm-with-joel',
      agent_provider: null,
      created_at: now(),
    });
    await wire(MG_RCPT, 'web:anais', RCPT);
    await wire(MG_PEER, 'web:joel', PEER);
    await createUser({ id: 'web:joel', kind: 'web', display_name: 'Joel', created_at: now() });

    // A durable per-correspondent thread on Anaïs's web group, from Joel.
    await createSession({
      id: 'sess-peer-joel',
      agent_group_id: RCPT,
      messaging_group_id: MG_RCPT,
      thread_id: peerThreadId(PEER),
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: now(),
      created_at: now(),
    });
  });

  afterEach(async () => {
    await closeDb();
  });

  it('titles a peer thread by the person behind the peer agent group', async () => {
    const threads = await listThreads('web:anais');
    expect(threads).toHaveLength(1);
    expect(threads[0].threadId).toBe(peerThreadId(PEER));
    expect(threads[0].title).toBe('Joel');
  });

  it('an explicit rename override still wins over the correspondent label', async () => {
    await setThreadTitle(MG_RCPT, peerThreadId(PEER), 'Dad');
    const threads = await listThreads('web:anais');
    expect(threads[0].title).toBe('Dad');
  });

  it('falls back to a prettified handle when the peer has no user display_name', async () => {
    // Peer whose web user has no display name.
    await createAgentGroup({
      id: 'ag-jay',
      name: 'Calcifer',
      folder: 'dm-with-jay',
      agent_provider: null,
      created_at: now(),
    });
    await wire('mg-web-jay', 'web:jay', 'ag-jay');
    await createSession({
      id: 'sess-peer-jay',
      agent_group_id: RCPT,
      messaging_group_id: MG_RCPT,
      thread_id: peerThreadId('ag-jay'),
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: now(),
      created_at: now(),
    });
    const threads = await listThreads('web:anais');
    const jay = threads.find((t) => t.threadId === peerThreadId('ag-jay'));
    expect(jay?.title).toBe('Jay'); // prettified from web:jay (no user row)
  });

  it('titles a system thread by its prettified source', async () => {
    await createSession({
      id: 'sess-sys-reminders',
      agent_group_id: RCPT,
      messaging_group_id: MG_RCPT,
      thread_id: systemThreadId('reminders'),
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: now(),
      created_at: now(),
    });
    const threads = await listThreads('web:anais');
    const sys = threads.find((t) => t.threadId === systemThreadId('reminders'));
    expect(sys?.title).toBe('Reminders');
  });
});
