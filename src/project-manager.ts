import { spawnSync } from 'child_process';

import { log } from './log.js';
import { loadProjectConfigs } from './project-config.js';
import {
  createProjectRun,
  createServeRun,
  getActiveProjectRun,
  getActiveServeRun,
  getActiveYakRun,
  getLatestProjectRun,
  updateProjectRun,
  updateServeRun,
} from './db/project-runs.js';
import { runProjectAgent } from './project-runner.js';
import { removeWorktree } from './worktree-manager.js';
import { CONTAINER_RUNTIME_BIN, stopContainer } from './container-runtime.js';
import { readWorkspaceServeJson, startServeContainer, stopServeContainer } from './serve-runner.js';

// --- Prompt construction ---

function buildPrompt(projectName: string, yakId?: string, extraPrompt?: string): string {
  const header = `You are a background project agent working on the **${projectName}** project. The repo has been cloned to your current working directory.`;

  if (extraPrompt && !yakId) {
    return `${header}\n\n${extraPrompt}`;
  }

  if (!yakId) {
    return `${header}

Begin by exploring the project: review its structure, recent git history (last 10 commits), and any obvious open work. Report your findings.`;
  }

  const extraSection = extraPrompt ? `\n\nAdditional context: ${extraPrompt}` : '';

  return `${header}

Your assigned task is **${yakId}** from this project's task tracker. Run \`yak show ${yakId}\` to read the full details, then \`yak shave ${yakId}\` to mark it in-progress before starting work. When done, run \`yak shorn ${yakId}\` and commit your changes.${extraSection}`;
}

// --- Delivery helpers ---

export type Notify = (text: string) => Promise<void>;

// --- Run lifecycle ---

export async function startProjectRun(opts: {
  projectName: string;
  yakId?: string;
  prompt?: string;
  notify: Notify;
}): Promise<void> {
  const { projectName, yakId, prompt: extraPrompt, notify } = opts;

  const configs = loadProjectConfigs();
  const project = configs.find((c) => c.name === projectName);
  if (!project) {
    const known = configs.map((c) => c.name).join(', ') || 'none';
    await notify(`No project named "${projectName}" found. Configured projects: ${known}`);
    return;
  }

  if (yakId) {
    const activeYak = getActiveYakRun(projectName, yakId);
    if (activeYak) {
      const ago = humanDuration(Date.now() - new Date(activeYak.created_at).getTime());
      await notify(
        `**${projectName}** (${yakId}) is already running (started ${ago} ago). Use abandon_project to stop it first.`,
      );
      return;
    }
  } else {
    const active = getActiveProjectRun(projectName);
    if (active) {
      const ago = humanDuration(Date.now() - new Date(active.created_at).getTime());
      await notify(`**${projectName}** is already running (started ${ago} ago). Use abandon_project to stop it first.`);
      return;
    }
  }

  const prompt = buildPrompt(projectName, yakId, extraPrompt);
  const projectId = `${projectName}-${Date.now()}`;

  createProjectRun({
    id: projectId,
    project_name: projectName,
    yak_id: yakId ?? null,
    initiated_by_jid: `project:${projectName}`,
  });

  log.info('Starting project run', { projectId, projectName, yakId });

  const startMsg = yakId ? `Starting work on **${projectName}** (${yakId})…` : `Starting work on **${projectName}**…`;
  await notify(startMsg);

  let lastResult: string | null = null;

  const runPromise = runProjectAgent(
    { projectId, project, prompt, yakId, assistantName: 'Calcifer' },
    (_proc, containerName) => {
      updateProjectRun(projectId, { container_name: containerName });
    },
    async (output) => {
      if (output.result) lastResult = output.result;
      if (output.newSessionId) {
        updateProjectRun(projectId, { session_id: output.newSessionId });
      }
    },
  );

  runPromise
    .then((result) => {
      if (result.status === 'success') {
        updateProjectRun(projectId, { status: 'done', result: lastResult });
        const summary = lastResult ? `**${projectName}** finished:\n\n${lastResult}` : `**${projectName}** finished.`;
        notify(summary).catch((err) => log.error('Failed to send project completion message', { err }));
      } else {
        updateProjectRun(projectId, { status: 'failed', result: result.error ?? null });
        notify(`**${projectName}** failed: ${result.error ?? 'unknown error'}`).catch((err) =>
          log.error('Failed to send project failure message', { err }),
        );
      }
    })
    .catch((err) => {
      log.error('Unexpected error in project run', { err, projectId });
      updateProjectRun(projectId, {
        status: 'failed',
        result: err instanceof Error ? err.message : String(err),
      });
    });
}

export function getProjectStatus(projectName: string): string {
  const active = getActiveProjectRun(projectName);
  if (active) {
    const ago = humanDuration(Date.now() - new Date(active.created_at).getTime());
    const yakPart = active.yak_id ? ` on ${active.yak_id}` : '';
    return `**${projectName}** is running${yakPart} (started ${ago} ago).`;
  }

  const latest = getLatestProjectRun(projectName);
  if (!latest) return `No runs found for **${projectName}**.`;

  const ago = humanDuration(Date.now() - new Date(latest.created_at).getTime());
  const yakPart = latest.yak_id ? ` on ${latest.yak_id}` : '';
  return `**${projectName}** last ran${yakPart} ${ago} ago — status: ${latest.status}.`;
}

export function abandonProjectRun(projectName: string, yakId?: string): string {
  const active = yakId ? getActiveYakRun(projectName, yakId) : getActiveProjectRun(projectName);
  const label = yakId ? `**${projectName}** (${yakId})` : `**${projectName}**`;
  if (!active) return `No active run found for ${label}.`;

  if (active.container_name) {
    try {
      stopContainer(active.container_name);
    } catch (err) {
      log.warn('Failed to stop container during abandon', { err, projectName, container: active.container_name });
    }
  }

  updateProjectRun(active.id, { status: 'abandoned' });
  log.info('Project run abandoned', { projectId: active.id, projectName, yakId });

  if (active.yak_id) {
    try {
      removeWorktree(projectName, active.yak_id);
    } catch (err) {
      log.warn('Failed to remove worktree during abandon', { err, projectName, yakId: active.yak_id });
    }
  }

  return `${label} abandoned.`;
}

// --- Serve lifecycle ---

export async function startServe(opts: {
  projectName: string;
  serveCmd?: string;
  servePort?: number;
  notify: Notify;
}): Promise<void> {
  const { projectName, notify } = opts;

  const configs = loadProjectConfigs();
  const project = configs.find((c) => c.name === projectName);
  if (!project) {
    await notify(`No project named "${projectName}" found.`);
    return;
  }

  const existing = getActiveServeRun(projectName);
  if (existing) {
    await notify(
      `**${projectName}** is already serving at http://localhost:${existing.host_port} — call stop_serve first to replace it.`,
    );
    return;
  }

  const workspaceJson = readWorkspaceServeJson(projectName);
  const serveCmd = opts.serveCmd ?? workspaceJson?.serve_cmd ?? project.serve_cmd;
  const servePort = opts.servePort ?? workspaceJson?.serve_port ?? project.serve_port;

  if (!serveCmd || !servePort) {
    await notify(
      `**${projectName}**: no serve command configured. Add serve_cmd/serve_port to projects/${projectName}/config.yaml or have the build agent write a serve.json to the workspace root.`,
    );
    return;
  }

  try {
    const { containerName, hostPort } = await startServeContainer({
      projectName,
      runtime: project.runtime,
      serveCmd,
      servePort,
      forwardEnv: project.forward_env,
    });

    const runId = `serve-${projectName}-${Date.now()}`;
    createServeRun({
      id: runId,
      project_name: projectName,
      project_id: projectName,
      container_name: containerName,
      host_port: hostPort,
      serve_port: servePort,
      serve_cmd: serveCmd,
    });

    log.info('Serve container started', { projectName, containerName, hostPort });
    await notify(
      `**${projectName}** is now serving at http://localhost:${hostPort} (bound to 0.0.0.0 — accessible from any device on the local network)`,
    );

    // Health check: tail logs 15s after startup and surface any errors.
    setTimeout(() => {
      try {
        const result = spawnSync(CONTAINER_RUNTIME_BIN, ['logs', '--tail', '30', containerName], {
          encoding: 'utf-8',
          timeout: 10_000,
        });
        const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
        if (output && /error|exception|traceback|failed|authentication|rate.?limit/i.test(output)) {
          const snippet = output.slice(-1500);
          notify(
            `**${projectName}** serve container health check — errors detected:\n\`\`\`\n${snippet}\n\`\`\``,
          ).catch(() => {});
        }
      } catch {
        // Health check failure is non-fatal
      }
    }, 15_000);
  } catch (err) {
    log.error('Failed to start serve container', { err, projectName });
    await notify(
      `Failed to start serve container for **${projectName}**: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function stopServe(projectName: string): string {
  const active = getActiveServeRun(projectName);
  if (!active) return `No active serve found for **${projectName}**.`;

  try {
    stopServeContainer(active.container_name);
  } catch (err) {
    log.warn('Failed to stop serve container', { err, projectName, container: active.container_name });
  }

  updateServeRun(active.id, { status: 'stopped' });
  log.info('Serve stopped', { projectName, container: active.container_name });
  return `**${projectName}** serve stopped.`;
}

export function getServeStatus(projectName: string): string {
  const active = getActiveServeRun(projectName);
  if (active) {
    const ago = humanDuration(Date.now() - new Date(active.created_at).getTime());
    return `**${projectName}** is serving at http://localhost:${active.host_port} (bound to 0.0.0.0, started ${ago} ago).`;
  }
  return `**${projectName}** is not currently serving.`;
}

// --- Utilities ---

function humanDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
