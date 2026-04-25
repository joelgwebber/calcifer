import fs from 'fs';
import path from 'path';

import { parse as parseYaml } from 'yaml';

import { PROJECTS_DIR } from './config.js';
import { log } from './log.js';

export type ProjectRuntime = 'python' | 'node' | 'rust';

export interface ProjectConfig {
  name: string;
  repo: string;
  default_branch: string;
  runtime: ProjectRuntime;
  clone_flags?: string;
  submodule_depth?: number;
  test_cmd?: string;
  serve_cmd?: string;
  serve_port?: number;
}

const VALID_RUNTIMES: ProjectRuntime[] = ['python', 'node', 'rust'];

function parseProjectConfig(raw: unknown, sourceFile: string): ProjectConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    log.warn('Project config must be a YAML object', { sourceFile });
    return null;
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    log.warn("Project config missing required field 'name'", { sourceFile });
    return null;
  }
  if (typeof obj.repo !== 'string' || !obj.repo.trim()) {
    log.warn("Project config missing required field 'repo'", { sourceFile });
    return null;
  }
  if (!VALID_RUNTIMES.includes(obj.runtime as ProjectRuntime)) {
    log.warn("Project config has invalid 'runtime' (must be python|node|rust)", { sourceFile, runtime: obj.runtime });
    return null;
  }

  return {
    name: obj.name.trim(),
    repo: obj.repo.trim(),
    default_branch:
      typeof obj.default_branch === 'string' && obj.default_branch.trim() ? obj.default_branch.trim() : 'main',
    runtime: obj.runtime as ProjectRuntime,
    clone_flags: typeof obj.clone_flags === 'string' && obj.clone_flags.trim() ? obj.clone_flags.trim() : undefined,
    submodule_depth:
      typeof obj.submodule_depth === 'number' && Number.isInteger(obj.submodule_depth) && obj.submodule_depth > 0
        ? obj.submodule_depth
        : undefined,
    test_cmd: typeof obj.test_cmd === 'string' && obj.test_cmd.trim() ? obj.test_cmd.trim() : undefined,
    serve_cmd: typeof obj.serve_cmd === 'string' && obj.serve_cmd.trim() ? obj.serve_cmd.trim() : undefined,
    serve_port:
      typeof obj.serve_port === 'number' && Number.isInteger(obj.serve_port) && obj.serve_port > 0
        ? obj.serve_port
        : undefined,
  };
}

export function loadProjectConfigs(projectsDir: string = PROJECTS_DIR): ProjectConfig[] {
  if (!fs.existsSync(projectsDir)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch (err) {
    log.warn('Failed to read projects directory', { projectsDir, err });
    return [];
  }

  const configs: ProjectConfig[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const configPath = path.join(projectsDir, entry.name, 'config.yaml');
    if (!fs.existsSync(configPath)) continue;

    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = parseYaml(raw);
      const config = parseProjectConfig(parsed, configPath);
      if (config) configs.push(config);
    } catch (err) {
      log.warn('Failed to parse project config', { configPath, err });
    }
  }

  return configs;
}

export function getProjectSupplementPath(projectName: string): string {
  return path.join(PROJECTS_DIR, projectName, 'CLAUDE.md');
}
