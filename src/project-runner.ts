import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { OneCLI } from '@onecli-sh/sdk';

import {
  CONTAINER_MAX_OUTPUT_SIZE,
  CONTAINER_TIMEOUT,
  DATA_DIR,
  IDLE_TIMEOUT,
  ONECLI_API_KEY,
  ONECLI_URL,
  TIMEZONE,
} from './config.js';
import { CONTAINER_RUNTIME_BIN, hostGatewayArgs, readonlyMountArgs, stopContainer } from './container-runtime.js';
import { readEnvFile } from './env.js';
import { log } from './log.js';
import { ProjectConfig, ProjectRuntime, getProjectSupplementPath } from './project-config.js';
import {
  ensureProjectRepo,
  ensureWorktree,
  projectRepoDir,
  projectYakSessionsParent,
  safeId,
} from './worktree-manager.js';

// Must match agent-runner output markers
const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';

export interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

export interface ProjectRunInput {
  projectId: string;
  project: ProjectConfig;
  prompt: string;
  yakId?: string;
  sessionId?: string;
  assistantName?: string;
}

interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readonly: boolean;
}

const onecli = new OneCLI({ url: ONECLI_URL, apiKey: ONECLI_API_KEY });

// New agents are created in `selective` mode (no secrets). Call this after
// ensureAgent to flip them to `all` so the vault injects credentials automatically.
async function ensureAgentSecretModeAll(identifier: string): Promise<void> {
  try {
    const res = await fetch(`${ONECLI_URL}/api/agents`);
    const data = (await res.json()) as { data?: { id: string; identifier: string }[] };
    const agents = data.data ?? [];
    const agent = agents.find((a) => a.identifier === identifier);
    if (!agent) return;
    await fetch(`${ONECLI_URL}/api/agents/${agent.id}/secret-mode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'all' }),
    });
    log.info('OneCLI agent secret mode set to all', { identifier });
  } catch (err) {
    log.warn('Failed to set OneCLI agent secret mode', { identifier, err });
  }
}

export function projectImageName(runtime: ProjectRuntime): string {
  return `nanoclaw-agent-${runtime}:latest`;
}

export function projectDir(projectName: string): string {
  return path.join(DATA_DIR, 'projects', projectName);
}

/** Returns the main repo directory. Kept for backward-compat callers (serve, yak_project). */
export function projectWorkspaceDir(projectName: string): string {
  return projectRepoDir(projectName);
}

export function projectContextDir(projectName: string): string {
  return path.join(projectDir(projectName), 'context');
}

export function projectIpcDir(projectName: string): string {
  return path.join(projectDir(projectName), 'ipc');
}

function projectSessionsDir(projectName: string): string {
  return path.join(projectDir(projectName), 'sessions');
}

function writeContextDir(project: ProjectConfig): string {
  const ctxDir = projectContextDir(project.name);
  fs.mkdirSync(ctxDir, { recursive: true });

  fs.writeFileSync(
    path.join(ctxDir, 'project.json'),
    JSON.stringify(
      {
        repo: project.repo,
        default_branch: project.default_branch,
        clone_flags: project.clone_flags,
        submodule_depth: project.submodule_depth,
        test_cmd: project.test_cmd,
        projectName: project.name,
      },
      null,
      2,
    ),
  );

  const supplementPath = getProjectSupplementPath(project.name);
  if (fs.existsSync(supplementPath)) {
    fs.copyFileSync(supplementPath, path.join(ctxDir, 'CLAUDE.md'));
  }

  return ctxDir;
}

function buildProjectMounts(project: ProjectConfig, yakId?: string): VolumeMount[] {
  const mounts: VolumeMount[] = [];
  const calciferRoot = process.cwd();

  // Ensure main repo exists (clone or migrate workspace/ → repo/).
  ensureProjectRepo(project);

  // /workspace/task: per-yak worktree when yakId present, main repo otherwise.
  const taskDir = yakId ? ensureWorktree(project, yakId) : projectRepoDir(project.name);
  mounts.push({ hostPath: taskDir, containerPath: '/workspace/task', readonly: false });

  const ctxDir = writeContextDir(project);
  mounts.push({ hostPath: ctxDir, containerPath: '/workspace/context', readonly: true });

  const ipcDir = projectIpcDir(project.name);
  fs.mkdirSync(path.join(ipcDir, 'messages'), { recursive: true });
  fs.mkdirSync(path.join(ipcDir, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(ipcDir, 'input'), { recursive: true });
  mounts.push({ hostPath: ipcDir, containerPath: '/workspace/ipc', readonly: false });

  // Per-yak .claude state when yakId present; shared fallback otherwise.
  const sessionsParent = yakId
    ? projectYakSessionsParent(project.name, yakId)
    : projectSessionsDir(project.name);
  const sessionsDir = path.join(sessionsParent, '.claude');
  fs.mkdirSync(sessionsDir, { recursive: true });
  const settingsFile = path.join(sessionsDir, 'settings.json');
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(
      settingsFile,
      JSON.stringify(
        {
          env: {
            CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
            CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1',
            CLAUDE_CODE_ADDITIONAL_DIRECTORIES: '/workspace/context',
            CLAUDE_CODE_DISABLE_AUTO_MEMORY: '0',
          },
        },
        null,
        2,
      ) + '\n',
    );
  }
  const skillsSrc = path.join(calciferRoot, 'container', 'skills');
  const skillsDst = path.join(sessionsDir, 'skills');
  if (fs.existsSync(skillsSrc)) {
    for (const skillDir of fs.readdirSync(skillsSrc)) {
      const srcDir = path.join(skillsSrc, skillDir);
      if (!fs.statSync(srcDir).isDirectory()) continue;
      fs.cpSync(srcDir, path.join(skillsDst, skillDir), { recursive: true });
    }
  }
  mounts.push({ hostPath: sessionsDir, containerPath: '/home/node/.claude', readonly: false });

  const agentRunnerSrc = path.join(calciferRoot, 'container', 'agent-runner', 'src');
  const runnerDir = path.join(sessionsParent, 'agent-runner-src');
  if (fs.existsSync(agentRunnerSrc)) {
    const needsCopy =
      !fs.existsSync(runnerDir) ||
      (() => {
        for (const entry of fs.readdirSync(agentRunnerSrc)) {
          const src = path.join(agentRunnerSrc, entry);
          const dst = path.join(runnerDir, entry);
          if (!fs.existsSync(dst)) return true;
          if (fs.statSync(src).mtimeMs > fs.statSync(dst).mtimeMs) return true;
        }
        return false;
      })();
    if (needsCopy) {
      fs.cpSync(agentRunnerSrc, runnerDir, { recursive: true });
    }
  }
  mounts.push({ hostPath: runnerDir, containerPath: '/app/src', readonly: false });

  return mounts;
}

async function buildProjectContainerArgs(
  project: ProjectConfig,
  mounts: VolumeMount[],
  containerName: string,
): Promise<string[]> {
  const args: string[] = ['run', '-i', '--rm', '--name', containerName];

  args.push('-e', `TZ=${TIMEZONE}`);

  const { GITHUB_TOKEN } = readEnvFile(['GITHUB_TOKEN']);
  if (GITHUB_TOKEN) {
    args.push('-e', `GITHUB_TOKEN=${GITHUB_TOKEN}`);
  }

  // OneCLI gateway — injects HTTPS_PROXY + certs for credential injection
  const agentIdentifier = `project-${project.name}`;
  try {
    const { created } = await onecli.ensureAgent({ name: project.name, identifier: agentIdentifier });
    if (created) await ensureAgentSecretModeAll(agentIdentifier);
    const onecliApplied = await onecli.applyContainerConfig(args, { addHostMapping: false, agent: agentIdentifier });
    if (onecliApplied) {
      log.info('OneCLI gateway applied for project container', { containerName });
    } else {
      log.warn('OneCLI gateway not applied — project container will have no credentials', { containerName });
    }
  } catch (err) {
    log.warn('OneCLI gateway error for project container', { containerName, err });
  }

  // CLAUDE_CODE_OAUTH_TOKEN=placeholder is a sentinel that applyContainerConfig
  // already sets via the OneCLI container-config endpoint. We add it explicitly
  // here as a fallback in case applyContainerConfig didn't run (e.g. no vault).
  // Do NOT set ANTHROPIC_API_KEY — that would make the claude binary use the
  // x-api-key auth path, which the OneCLI 'anthropic' type secret does not
  // intercept. The OAuth Bearer path (CLAUDE_CODE_OAUTH_TOKEN) is the only
  // path the proxy injects credentials into.
  args.push('-e', 'CLAUDE_CODE_OAUTH_TOKEN=placeholder');

  args.push(...hostGatewayArgs());

  const hostUid = process.getuid?.();
  const hostGid = process.getgid?.();
  if (hostUid != null && hostUid !== 0 && hostUid !== 1000) {
    args.push('--user', `${hostUid}:${hostGid}`);
    args.push('-e', 'HOME=/home/node');
  }

  for (const mount of mounts) {
    if (mount.readonly) {
      args.push(...readonlyMountArgs(mount.hostPath, mount.containerPath));
    } else {
      args.push('-v', `${mount.hostPath}:${mount.containerPath}`);
    }
  }

  args.push(projectImageName(project.runtime));

  return args;
}

export async function runProjectAgent(
  input: ProjectRunInput,
  onProcess: (proc: ChildProcess, containerName: string) => void,
  onOutput?: (output: ContainerOutput) => Promise<void>,
): Promise<ContainerOutput> {
  const startTime = Date.now();
  const { projectId, project, prompt, yakId, sessionId, assistantName } = input;

  const mounts = buildProjectMounts(project, yakId);
  const safeName = project.name.replace(/[^a-zA-Z0-9-]/g, '-');
  // Stable name when yakId is known; timestamp-based for ad-hoc runs.
  const containerName = yakId
    ? `nanoclaw-project-${safeName}-${safeId(yakId)}`
    : `nanoclaw-project-${safeName}-${Date.now()}`;
  const containerArgs = await buildProjectContainerArgs(project, mounts, containerName);

  const containerInput = {
    prompt,
    sessionId,
    groupFolder: `project-${project.name}`,
    chatJid: `project:${project.name}`,
    isMain: false,
    assistantName: assistantName ?? 'Andy',
    cwd: '/workspace/task',
    oneShot: true,
  };

  log.info('Spawning project agent container', {
    projectId,
    projectName: project.name,
    containerName,
    runtime: project.runtime,
  });

  const logsDir = path.join(DATA_DIR, 'projects', project.name, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  return new Promise((resolve) => {
    const container = spawn(CONTAINER_RUNTIME_BIN, containerArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    onProcess(container, containerName);

    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let parseBuffer = '';
    let newSessionId: string | undefined;
    let outputChain = Promise.resolve();
    let hadStreamingOutput = false;
    let lastOutputWasError = false;
    let lastOutputError: string | undefined;

    container.stdin?.write(JSON.stringify(containerInput));
    container.stdin?.end();

    container.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      if (!stdoutTruncated) {
        const remaining = CONTAINER_MAX_OUTPUT_SIZE - stdout.length;
        if (chunk.length > remaining) {
          stdout += chunk.slice(0, remaining);
          stdoutTruncated = true;
          log.warn('Project container stdout truncated', { projectId, size: stdout.length });
        } else {
          stdout += chunk;
        }
      }

      if (onOutput) {
        parseBuffer += chunk;
        let startIdx: number;
        while ((startIdx = parseBuffer.indexOf(OUTPUT_START_MARKER)) !== -1) {
          const endIdx = parseBuffer.indexOf(OUTPUT_END_MARKER, startIdx);
          if (endIdx === -1) break;
          const jsonStr = parseBuffer.slice(startIdx + OUTPUT_START_MARKER.length, endIdx).trim();
          parseBuffer = parseBuffer.slice(endIdx + OUTPUT_END_MARKER.length);
          try {
            const parsed = JSON.parse(jsonStr) as ContainerOutput;
            if (parsed.newSessionId) newSessionId = parsed.newSessionId;
            if (parsed.status === 'error') {
              lastOutputWasError = true;
              lastOutputError = parsed.error;
            } else {
              lastOutputWasError = false;
            }
            hadStreamingOutput = true;
            resetTimeout();
            outputChain = outputChain.then(() => onOutput(parsed));
          } catch (err) {
            log.warn('Failed to parse streamed project output', { projectId, err });
          }
        }
      }
    });

    container.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      chunk
        .trim()
        .split('\n')
        .forEach((line: string) => {
          if (line) log.debug(line, { projectId });
        });
      if (!stdoutTruncated) {
        const remaining = CONTAINER_MAX_OUTPUT_SIZE - stderr.length;
        if (chunk.length > remaining) stderr += chunk.slice(0, remaining);
        else stderr += chunk;
      }
    });

    let timedOut = false;
    const timeoutMs = Math.max(CONTAINER_TIMEOUT, IDLE_TIMEOUT + 30_000);

    const killOnTimeout = () => {
      timedOut = true;
      log.error('Project container timed out', { projectId, containerName });
      try {
        stopContainer(containerName);
      } catch {
        container.kill('SIGKILL');
      }
    };

    let timeout = setTimeout(killOnTimeout, timeoutMs);
    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(killOnTimeout, timeoutMs);
    };

    container.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      if (timedOut) {
        if (hadStreamingOutput) {
          log.info('Project container timed out after output (idle cleanup)', {
            projectId,
            containerName,
            duration,
          });
          outputChain.then(() => resolve({ status: 'success', result: null, newSessionId }));
        } else {
          resolve({
            status: 'error',
            result: null,
            error: `Project container timed out after ${CONTAINER_TIMEOUT}ms with no output`,
          });
        }
        return;
      }

      if (code !== 0) {
        if (hadStreamingOutput) {
          if (lastOutputWasError) {
            log.info('Project container exited non-zero with error output', {
              projectId,
              code,
              duration,
              error: lastOutputError,
            });
            outputChain.then(() =>
              resolve({ status: 'error', result: null, error: lastOutputError ?? 'Agent completed with error' }),
            );
          } else {
            log.info('Project container exited non-zero after producing output — treating as success', {
              projectId,
              code,
              duration,
            });
            outputChain.then(() => resolve({ status: 'success', result: null, newSessionId }));
          }
          return;
        }
        const errorDetail = (stderr || stdout).slice(-500);
        log.error('Project container exited with error', {
          projectId,
          code,
          duration,
          stderr: stderr.slice(-500),
          stdout: stdout.slice(-500),
        });
        resolve({
          status: 'error',
          result: null,
          error: `Project container exited with code ${code}: ${errorDetail.slice(-200)}`,
        });
        return;
      }

      if (onOutput) {
        outputChain.then(() => {
          log.info('Project container completed', { projectId, duration, newSessionId });
          resolve({ status: 'success', result: null, newSessionId });
        });
        return;
      }

      resolve({ status: 'success', result: null, newSessionId });
    });

    container.on('error', (err) => {
      clearTimeout(timeout);
      log.error('Project container spawn error', { projectId, err });
      resolve({
        status: 'error',
        result: null,
        error: `Spawn error: ${(err as Error).message}`,
      });
    });
  });
}
