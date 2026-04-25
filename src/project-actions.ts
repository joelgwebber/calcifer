/**
 * Project system delivery action handlers.
 *
 * Registers handlers for system actions sent by the project MCP tools.
 * The agent writes system actions to messages_out; the host's delivery
 * module dispatches them here via registerDeliveryAction.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import type { Session } from './types.js';
import type Database from 'better-sqlite3';

import { registerDeliveryAction } from './delivery.js';
import { log } from './log.js';
import { getMessagingGroup } from './db/messaging-groups.js';
import {
  abandonProjectRun,
  getProjectStatus,
  getServeStatus,
  startProjectRun,
  startServe,
  stopServe,
} from './project-manager.js';
import type { DeliveryTarget } from './project-manager.js';
import { projectWorkspaceDir } from './project-runner.js';

function findYakScript(): string | null {
  const yakDir = path.join(process.env.HOME || '', '.claude/plugins/cache/yaks-marketplace/yaks');
  if (!fs.existsSync(yakDir)) return null;
  const versions = fs.readdirSync(yakDir).sort();
  if (!versions.length) return null;
  return path.join(yakDir, versions[versions.length - 1], 'scripts/yak.py');
}

function resolveTarget(session: Session): DeliveryTarget | null {
  if (!session.messaging_group_id) return null;
  const mg = getMessagingGroup(session.messaging_group_id);
  if (!mg) return null;
  return {
    channelType: mg.channel_type,
    platformId: mg.platform_id,
    threadId: session.thread_id,
  };
}

export function registerProjectActions(): void {
  registerDeliveryAction('start_project', async (content, session, _inDb: Database.Database) => {
    const target = resolveTarget(session);
    if (!target) {
      log.warn('start_project: no delivery target for session', { sessionId: session.id });
      return;
    }
    await startProjectRun({
      projectName: content.project_name as string,
      yakId: (content.yak_id as string | null) ?? undefined,
      prompt: (content.prompt as string | null) ?? undefined,
      target,
    });
  });

  registerDeliveryAction('project_status', async (content, session, _inDb: Database.Database) => {
    const target = resolveTarget(session);
    if (!target) return;
    const status = getProjectStatus(content.project_name as string);
    const { getDeliveryAdapter } = await import('./delivery.js');
    const adapter = getDeliveryAdapter();
    if (adapter) {
      await adapter.deliver(target.channelType, target.platformId, target.threadId, 'chat',
        JSON.stringify({ type: 'text', text: status }));
    }
  });

  registerDeliveryAction('abandon_project', async (content, session, _inDb: Database.Database) => {
    const target = resolveTarget(session);
    if (!target) return;
    const result = abandonProjectRun(content.project_name as string);
    const { getDeliveryAdapter } = await import('./delivery.js');
    const adapter = getDeliveryAdapter();
    if (adapter) {
      await adapter.deliver(target.channelType, target.platformId, target.threadId, 'chat',
        JSON.stringify({ type: 'text', text: result }));
    }
  });

  registerDeliveryAction('serve_project', async (content, session, _inDb: Database.Database) => {
    const target = resolveTarget(session);
    if (!target) return;
    await startServe({
      projectName: content.project_name as string,
      serveCmd: (content.serve_cmd as string | null) ?? undefined,
      servePort: (content.serve_port as number | null) ?? undefined,
      target,
    });
  });

  registerDeliveryAction('stop_serve', async (content, session, _inDb: Database.Database) => {
    const target = resolveTarget(session);
    if (!target) return;
    const result = stopServe(content.project_name as string);
    const { getDeliveryAdapter } = await import('./delivery.js');
    const adapter = getDeliveryAdapter();
    if (adapter) {
      await adapter.deliver(target.channelType, target.platformId, target.threadId, 'chat',
        JSON.stringify({ type: 'text', text: result }));
    }
  });

  registerDeliveryAction('restart_serve', async (content, session, _inDb: Database.Database) => {
    const target = resolveTarget(session);
    if (!target) return;
    // Atomic: stop then start
    stopServe(content.project_name as string);
    await startServe({
      projectName: content.project_name as string,
      serveCmd: (content.serve_cmd as string | null) ?? undefined,
      servePort: (content.serve_port as number | null) ?? undefined,
      target,
    });
  });

  registerDeliveryAction('serve_status', async (content, session, _inDb: Database.Database) => {
    const target = resolveTarget(session);
    if (!target) return;
    const result = getServeStatus(content.project_name as string);
    const { getDeliveryAdapter } = await import('./delivery.js');
    const adapter = getDeliveryAdapter();
    if (adapter) {
      await adapter.deliver(target.channelType, target.platformId, target.threadId, 'chat',
        JSON.stringify({ type: 'text', text: result }));
    }
  });

  registerDeliveryAction('yak_project', async (content, session, _inDb: Database.Database) => {
    const target = resolveTarget(session);
    if (!target) return;

    const projectName = content.project_name as string;
    const yakArgs = (content.yak_args as string[]) ?? [];
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
      output = result.stdout || '(no output)';
    } catch (err) {
      output = `Error: ${err instanceof Error ? err.message : String(err)}`;
    }

    const { getDeliveryAdapter } = await import('./delivery.js');
    const adapter = getDeliveryAdapter();
    if (adapter) {
      await adapter.deliver(
        target.channelType,
        target.platformId,
        target.threadId,
        'chat',
        JSON.stringify({ type: 'text', text: output || '(no output)' }),
      );
    }
  });

  log.info('Project system action handlers registered');
}
