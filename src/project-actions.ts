/**
 * Project system delivery action handlers.
 *
 * Registers handlers for system actions sent by the project MCP tools.
 * The agent writes system actions to messages_out; the host's delivery
 * module dispatches them here via registerDeliveryAction.
 *
 * Results are injected back into the agent's inbound.db (via writeSessionMessage
 * + wakeContainer) so Calcifer receives them and can relay them to the user.
 * This replaces the old adapter.deliver() approach, which bypassed Calcifer
 * and sent directly to the channel with no agent context.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import type { Session } from './types.js';
import type Database from 'better-sqlite3';

import { wakeContainer } from './container-runner.js';
import { CONTAINER_RUNTIME_BIN } from './container-runtime.js';
import { registerDeliveryAction } from './delivery.js';
import { getActiveServeRun } from './db/project-runs.js';
import { getSession } from './db/sessions.js';
import { log } from './log.js';
import { writeSessionMessage } from './session-manager.js';
import {
  abandonProjectRun,
  getProjectStatus,
  getServeStatus,
  startProjectRun,
  startServe,
  stopServe,
} from './project-manager.js';
import { loadProjectConfigs } from './project-config.js';
import { projectWorkspaceDir } from './project-runner.js';
import { ensureProjectRepo } from './worktree-manager.js';

function findYakScript(): string | null {
  const yakDir = path.join(process.env.HOME || '', '.claude/plugins/cache/yaks-marketplace/yaks');
  if (!fs.existsSync(yakDir)) return null;
  const versions = fs.readdirSync(yakDir).sort();
  if (!versions.length) return null;
  return path.join(yakDir, versions[versions.length - 1], 'scripts/yak.py');
}

function notifyAgent(session: Session, text: string): Promise<void> {
  writeSessionMessage(session.agent_group_id, session.id, {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'chat',
    timestamp: new Date().toISOString(),
    platformId: session.agent_group_id,
    channelType: 'agent',
    threadId: null,
    content: JSON.stringify({ text, sender: 'system', senderId: 'system' }),
  });
  const fresh = getSession(session.id);
  if (fresh) {
    return wakeContainer(fresh).catch((err: unknown) =>
      log.error('Failed to wake container after project notification', { err }),
    );
  }
  return Promise.resolve();
}

export function registerProjectActions(): void {
  registerDeliveryAction('start_project', async (content, session, _inDb: Database.Database) => {
    const notify = (text: string) => notifyAgent(session, text);
    await startProjectRun({
      projectName: content.project_name as string,
      yakId: (content.yak_id as string | null) ?? undefined,
      prompt: (content.prompt as string | null) ?? undefined,
      notify,
    });
  });

  registerDeliveryAction('project_status', async (content, session, _inDb: Database.Database) => {
    const status = getProjectStatus(content.project_name as string);
    await notifyAgent(session, status);
  });

  registerDeliveryAction('abandon_project', async (content, session, _inDb: Database.Database) => {
    const result = abandonProjectRun(content.project_name as string, content.yak_id as string | undefined);
    await notifyAgent(session, result);
  });

  registerDeliveryAction('serve_project', async (content, session, _inDb: Database.Database) => {
    const notify = (text: string) => notifyAgent(session, text);
    await startServe({
      projectName: content.project_name as string,
      serveCmd: (content.serve_cmd as string | null) ?? undefined,
      servePort: (content.serve_port as number | null) ?? undefined,
      notify,
    });
  });

  registerDeliveryAction('stop_serve', async (content, session, _inDb: Database.Database) => {
    const result = stopServe(content.project_name as string);
    await notifyAgent(session, result);
  });

  registerDeliveryAction('restart_serve', async (content, session, _inDb: Database.Database) => {
    const notify = (text: string) => notifyAgent(session, text);
    stopServe(content.project_name as string);
    await startServe({
      projectName: content.project_name as string,
      serveCmd: (content.serve_cmd as string | null) ?? undefined,
      servePort: (content.serve_port as number | null) ?? undefined,
      notify,
    });
  });

  registerDeliveryAction('serve_status', async (content, session, _inDb: Database.Database) => {
    const result = getServeStatus(content.project_name as string);
    await notifyAgent(session, result);
  });

  registerDeliveryAction('yak_project', async (content, session, _inDb: Database.Database) => {
    const projectName = content.project_name as string;
    const yakArgs = (content.yak_args as string[]) ?? [];

    // Ensure repo exists (clones or migrates workspace/ → repo/ as needed).
    const configs = loadProjectConfigs();
    const project = configs.find((c) => c.name === projectName);
    if (project) ensureProjectRepo(project);

    const workspaceDir = projectWorkspaceDir(projectName);

    let output: string;
    try {
      const yakScript = findYakScript();
      if (!yakScript) throw new Error('yak.py not found — is the yaks plugin installed?');
      if (!fs.existsSync(workspaceDir)) throw new Error(`Project workspace not found: ${workspaceDir}`);

      const result = spawnSync('python3', [yakScript, ...yakArgs], {
        encoding: 'utf-8',
        cwd: workspaceDir,
        timeout: 15_000,
      });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error((result.stderr || '').trim() || `yak exited with code ${result.status}`);
      output = `**yak result (${projectName}):**\n\n${result.stdout || '(no output)'}`;
    } catch (err) {
      output = `**yak result (${projectName}) — error:**\n\n${err instanceof Error ? err.message : String(err)}`;
    }

    await notifyAgent(session, output);
  });

  registerDeliveryAction('serve_logs', async (content, session, _inDb: Database.Database) => {
    const projectName = content.project_name as string;
    const serve = getActiveServeRun(projectName);

    let output: string;
    if (!serve) {
      output = `**serve logs (${projectName}):** No active serve container found.`;
    } else {
      const result = spawnSync(CONTAINER_RUNTIME_BIN, ['logs', '--tail', '100', serve.container_name], {
        encoding: 'utf-8',
        timeout: 10_000,
      });
      const combined = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      if (result.error) {
        output = `**serve logs (${projectName}) — error:** ${result.error.message}`;
      } else if (!combined) {
        output = `**serve logs (${projectName}):** (no output yet)`;
      } else {
        output = `**serve logs (${projectName}):**\n\`\`\`\n${combined}\n\`\`\``;
      }
    }

    await notifyAgent(session, output);
  });

  log.info('Project system action handlers registered');
}
