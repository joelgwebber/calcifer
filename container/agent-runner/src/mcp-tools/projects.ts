/**
 * Project agent MCP tools: start_project, project_status, abandon_project,
 * serve_project, stop_serve, restart_serve, serve_status, yak_project.
 *
 * These send system actions via messages_out — the host's delivery handler
 * processes them and sends results back as chat messages.
 *
 * Only registered when container.json includes "projects" in features[].
 */
import { writeMessageOut } from '../db/messages-out.js';
import { getSessionRouting } from '../db/session-routing.js';
import { registerTools } from './server.js';
import type { McpToolDefinition } from './types.js';

function generateId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function routing() {
  return getSessionRouting();
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function writeProjectAction(action: string, data: Record<string, unknown>): void {
  const r = routing();
  writeMessageOut({
    id: generateId(),
    kind: 'system',
    platform_id: r.platform_id,
    channel_type: r.channel_type,
    thread_id: r.thread_id,
    content: JSON.stringify({ action, ...data }),
  });
}

const startProject: McpToolDefinition = {
  tool: {
    name: 'start_project',
    description: `Start a background agent on a configured software project. The agent clones the repo, works on the task, commits results to a branch, and sends you a summary when done.

Available projects are in /workspace/extra/projects/*/config.yaml. Read a config to confirm the project name before starting.

The result is delivered as a chat message when the agent finishes — this tool returns immediately. After calling this tool, acknowledge to the user that the project has started and that you will share the result when it arrives. Do NOT predict, speculate about, or fabricate what the agent found or fixed — you have no way to know the outcome until the completion message arrives. Wait silently for that message.

If passing a yak_id, it must be a task ID from the project's own .yaks/ tracker (e.g. hello-world-abc1), not a Calcifer yak. Use yak_project to list available tasks first.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_name: { type: 'string', description: 'Project name matching a config in projects/*/config.yaml' },
        yak_id: { type: 'string', description: "Task ID from the project's own .yaks/ tracker" },
        prompt: { type: 'string', description: 'Additional instructions or task description' },
      },
      required: ['project_name'],
    },
  },
  async handler(args) {
    writeProjectAction('start_project', {
      project_name: args.project_name,
      yak_id: args.yak_id ?? null,
      prompt: args.prompt ?? null,
    });
    return ok(`Project agent for "${args.project_name as string}" started. You'll receive a message when it finishes.`);
  },
};

const projectStatus: McpToolDefinition = {
  tool: {
    name: 'project_status',
    description: 'Check the status of a background project agent run.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_name: { type: 'string', description: 'Project name to check' },
      },
      required: ['project_name'],
    },
  },
  async handler(args) {
    writeProjectAction('project_status', { project_name: args.project_name });
    return ok(`Status request sent for "${args.project_name as string}". The result will be sent as a message.`);
  },
};

const abandonProject: McpToolDefinition = {
  tool: {
    name: 'abandon_project',
    description: 'Stop a running background project agent.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_name: { type: 'string', description: 'Project name to abandon' },
      },
      required: ['project_name'],
    },
  },
  async handler(args) {
    writeProjectAction('abandon_project', { project_name: args.project_name });
    return ok(`Abandon request sent for "${args.project_name as string}".`);
  },
};

const serveProject: McpToolDefinition = {
  tool: {
    name: 'serve_project',
    description: `Start a lightweight serve container so the project's output can be previewed in a browser.

The serve container mounts the same workspace as the build run and executes the serve command. It stays running until you call stop_serve.

If serve_cmd and serve_port are omitted, the host will look for a serve.json file in the workspace root ({"serve_cmd": "...", "serve_port": 3000}) and fall back to the project config.

The URL will be sent as a message when the container starts.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_name: { type: 'string', description: 'Project name matching a config in projects/*/config.yaml' },
        serve_cmd: { type: 'string', description: 'Command to run, e.g. "npm start". Overrides config and serve.json.' },
        serve_port: { type: 'number', description: 'Port the serve_cmd listens on inside the container.' },
      },
      required: ['project_name'],
    },
  },
  async handler(args) {
    writeProjectAction('serve_project', {
      project_name: args.project_name,
      serve_cmd: args.serve_cmd ?? null,
      serve_port: args.serve_port ?? null,
    });
    return ok(`Serve request sent for "${args.project_name as string}". The URL will be sent as a message.`);
  },
};

const stopServe: McpToolDefinition = {
  tool: {
    name: 'stop_serve',
    description: 'Stop a running serve container for a project.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_name: { type: 'string', description: 'Project name to stop serving' },
      },
      required: ['project_name'],
    },
  },
  async handler(args) {
    writeProjectAction('stop_serve', { project_name: args.project_name });
    return ok(`Stop serve request sent for "${args.project_name as string}".`);
  },
};

const restartServe: McpToolDefinition = {
  tool: {
    name: 'restart_serve',
    description: `Stop any running serve container for a project and start a new one. Equivalent to stop_serve + serve_project but atomic.

Use this after a build completes to pick up the new workspace state without needing a manual stop first.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_name: { type: 'string', description: 'Project name matching a config in projects/*/config.yaml' },
        serve_cmd: { type: 'string', description: 'Command to run. Overrides config and serve.json.' },
        serve_port: { type: 'number', description: 'Port the serve_cmd listens on inside the container.' },
      },
      required: ['project_name'],
    },
  },
  async handler(args) {
    writeProjectAction('restart_serve', {
      project_name: args.project_name,
      serve_cmd: args.serve_cmd ?? null,
      serve_port: args.serve_port ?? null,
    });
    return ok(`Restart serve request sent for "${args.project_name as string}". The URL will be sent as a message.`);
  },
};

const serveStatus: McpToolDefinition = {
  tool: {
    name: 'serve_status',
    description: 'Check whether a project is currently being served and get its URL.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_name: { type: 'string', description: 'Project name to check' },
      },
      required: ['project_name'],
    },
  },
  async handler(args) {
    writeProjectAction('serve_status', { project_name: args.project_name });
    return ok(`Status request sent for "${args.project_name as string}". The result will be sent as a message.`);
  },
};

const yakProject: McpToolDefinition = {
  tool: {
    name: 'yak_project',
    description: `Run a yak command against a project's own task tracker (.yaks/ in the project workspace).

Use this to list tasks, create new ones, view details, add notes, or initialize tracking. Exactly one message arrives with the result — whether the command succeeds or errors, that message IS the complete response. Do not wait for a follow-up.

Examples:
- List open tasks: args=["list"]
- View a task: args=["show", "hello-world-abc1"]
- Add a task: args=["create", "--title", "Fix login bug", "--type", "bug", "--priority", "2"]
- Add a note: args=["update", "hello-world-abc1", "--note", "Discovered root cause"]
- Initialize (run once per project): args=["init"]`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_name: { type: 'string', description: 'Project name (must match a configured project)' },
        args: { type: 'array', items: { type: 'string' }, description: 'Yak CLI arguments, e.g. ["list"], ["show", "task-id"]' },
      },
      required: ['project_name', 'args'],
    },
  },
  async handler(args) {
    writeProjectAction('yak_project', {
      project_name: args.project_name,
      yak_args: args.args,
    });
    return ok(`Yak command sent for "${args.project_name as string}". The result will be sent as a message.`);
  },
};

const serveLogs: McpToolDefinition = {
  tool: {
    name: 'serve_logs',
    description: `Fetch recent stdout/stderr from a running serve container.

Use this to diagnose why a serve container is failing, crashing, or returning errors. Returns the last ~100 lines of container output. Exactly one message arrives with the result.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_name: { type: 'string', description: 'Project name to fetch logs for' },
      },
      required: ['project_name'],
    },
  },
  async handler(args) {
    writeProjectAction('serve_logs', { project_name: args.project_name });
    return ok(`Log request sent for "${args.project_name as string}". The result will be sent as a message.`);
  },
};

export function registerProjectTools(): void {
  registerTools([
    startProject,
    projectStatus,
    abandonProject,
    serveProject,
    stopServe,
    restartServe,
    serveStatus,
    yakProject,
    serveLogs,
  ]);
}
