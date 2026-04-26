/**
 * Project agent entry point.
 *
 * Reads a JSON ProjectInput from stdin, runs a one-shot Claude Code agent
 * on the project workspace, and emits output markers on stdout so the host
 * can parse the result.
 *
 * This is the container entrypoint for nanoclaw-agent-node / -python images.
 * It does NOT use the v2 session DB — the host (project-runner.ts) feeds the
 * prompt via stdin and reads the result from stdout markers. That is the
 * load-bearing contract; do not change it without updating project-runner.ts.
 *
 * Mount structure inside the project container:
 *   /workspace/task/     ← cloned project repo (CWD for the agent)
 *   /workspace/context/  ← project.json + optional CLAUDE.md supplement
 *   /app/src/            ← agent-runner source (this file, mounted RO)
 *   /home/node/.claude/  ← Claude SDK state + skill symlinks (RW)
 */

import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk';

// Must match OUTPUT_START_MARKER / OUTPUT_END_MARKER in src/project-runner.ts
const OUTPUT_START = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END = '---NANOCLAW_OUTPUT_END---';

interface ProjectInput {
  prompt: string;
  sessionId?: string;
  assistantName?: string;
  cwd?: string;
}

interface ProjectOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

// Keep in sync with the main agent-runner (claude.ts) for consistency.
const DISALLOWED_TOOLS = [
  'CronCreate',
  'CronDelete',
  'CronList',
  'ScheduleWakeup',
  'AskUserQuestion',
  'EnterPlanMode',
  'ExitPlanMode',
  'EnterWorktree',
  'ExitWorktree',
];

const ALLOWED_TOOLS = [
  'Bash',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'Task',
  'TaskOutput',
  'TaskStop',
  'TodoWrite',
  'ToolSearch',
  'Skill',
];

function emitOutput(output: ProjectOutput): void {
  process.stdout.write(`\n${OUTPUT_START}\n${JSON.stringify(output)}\n${OUTPUT_END}\n`);
}

function log(msg: string): void {
  process.stderr.write(`[project-agent] ${msg}\n`);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// Single-message async iterable — project runs are one-shot prompts.
async function* promptStream(prompt: string): AsyncGenerator<{
  type: 'user';
  message: { role: 'user'; content: string };
  parent_tool_use_id: null;
  session_id: string;
}> {
  yield {
    type: 'user',
    message: { role: 'user', content: prompt },
    parent_tool_use_id: null,
    session_id: '',
  };
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const input: ProjectInput = JSON.parse(raw);

  const cwd = input.cwd ?? '/workspace/task';
  const assistantName = input.assistantName ?? 'Calcifer';

  log(`Starting project agent (cwd: ${cwd})`);

  try {
    const sdkResult = sdkQuery({
      prompt: promptStream(input.prompt),
      options: {
        cwd,
        resume: input.sessionId,
        pathToClaudeCodeExecutable: '/pnpm/claude',
        systemPrompt: {
          type: 'preset' as const,
          preset: 'claude_code' as const,
          append: `You are ${assistantName}, a background project agent. The project repo is in your working directory. Work autonomously to complete the task. Commit your changes when done and write a brief summary of what you accomplished.`,
        },
        allowedTools: ALLOWED_TOOLS,
        disallowedTools: DISALLOWED_TOOLS,
        // /workspace/context holds project.json and an optional CLAUDE.md supplement.
        additionalDirectories: ['/workspace/context'],
        env: {
          ...process.env as Record<string, string>,
          // Auto-compact at the same window as the main agent runner.
          CLAUDE_CODE_AUTO_COMPACT_WINDOW: '165000',
        },
        permissionMode: 'bypassPermissions' as const,
        allowDangerouslySkipPermissions: true,
        // 'user' → /home/node/.claude/settings.json (skills, env overrides)
        // 'project' → .claude/ in the repo CWD (if the project has one)
        settingSources: ['user', 'project'] as const,
      },
    });

    let result: string | null = null;
    let sessionId: string | undefined;

    for await (const event of sdkResult) {
      if (event.type === 'system' && (event as { subtype?: string }).subtype === 'init') {
        sessionId = (event as { session_id: string }).session_id;
        log(`Session: ${sessionId}`);
      } else if (event.type === 'result') {
        result = (event as { result?: string }).result ?? null;
        log(`Result: ${result ? result.slice(0, 200) : '(empty)'}`);
      }
    }

    emitOutput({ status: 'success', result, newSessionId: sessionId });
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Error: ${message}`);
    emitOutput({ status: 'error', result: null, error: message });
    process.exit(1);
  }
}

main();
