import { spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';

import { CONTAINER_RUNTIME_BIN, hostGatewayArgs, stopContainer } from './container-runtime.js';
import { log } from './log.js';
import { ProjectRuntime } from './project-config.js';
import { projectImageName, projectWorkspaceDir } from './project-runner.js';

const SERVE_PORT_RANGE_START = 8100;
const SERVE_PORT_RANGE_END = 8199;

export interface ServeJson {
  serve_cmd: string;
  serve_port: number;
}

export function readWorkspaceServeJson(projectName: string): ServeJson | null {
  const serveFile = path.join(projectWorkspaceDir(projectName), 'serve.json');
  if (!fs.existsSync(serveFile)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(serveFile, 'utf-8')) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as Record<string, unknown>).serve_cmd === 'string' &&
      typeof (parsed as Record<string, unknown>).serve_port === 'number'
    ) {
      return parsed as ServeJson;
    }
    return null;
  } catch {
    return null;
  }
}

async function findFreePort(): Promise<number | null> {
  for (let port = SERVE_PORT_RANGE_START; port <= SERVE_PORT_RANGE_END; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => server.close(() => resolve(true)));
      server.listen(port, '0.0.0.0');
    });
    if (free) return port;
  }
  return null;
}

export async function startServeContainer(opts: {
  projectName: string;
  runtime: ProjectRuntime;
  serveCmd: string;
  servePort: number;
}): Promise<{ containerName: string; hostPort: number }> {
  const { projectName, runtime, serveCmd, servePort } = opts;

  const hostPort = await findFreePort();
  if (!hostPort) throw new Error('No free port available in range 8100–8199');

  const workspaceDir = projectWorkspaceDir(projectName);
  const safeName = projectName.replace(/[^a-zA-Z0-9-]/g, '-');
  const containerName = `nanoclaw-serve-${safeName}-${Date.now()}`;
  const image = projectImageName(runtime);

  const args = [
    'run',
    '--rm',
    '-d',
    '--name',
    containerName,
    '--entrypoint',
    'sh',
    '-p',
    `0.0.0.0:${hostPort}:${servePort}`,
    '-v',
    `${workspaceDir}:/workspace/task`,
    '-w',
    '/workspace/task',
    ...hostGatewayArgs(),
    image,
    '-c',
    serveCmd,
  ];

  log.info('Starting serve container', { projectName, containerName, hostPort, servePort, serveCmd });

  return new Promise((resolve, reject) => {
    const proc = spawn(CONTAINER_RUNTIME_BIN, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Serve container failed to start: ${stderr.trim()}`));
      } else {
        resolve({ containerName, hostPort });
      }
    });
    proc.on('error', reject);
  });
}

export { stopContainer as stopServeContainer };
