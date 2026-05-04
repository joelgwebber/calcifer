import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { log } from './log.js';
import type { ProjectConfig } from './project-config.js';
import { projectDir } from './project-runner.js';

export function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-_.]/g, '-');
}

export function projectRepoDir(projectName: string): string {
  return path.join(projectDir(projectName), 'repo');
}

export function projectWorktreeDir(projectName: string, yakId: string): string {
  return path.join(projectDir(projectName), 'worktrees', safeId(yakId));
}

export function projectYakSessionsParent(projectName: string, yakId: string): string {
  return path.join(projectDir(projectName), 'sessions', safeId(yakId));
}

/**
 * Ensure the main project repo exists.
 * - If workspace/ exists but repo/ doesn't: migrate in place (rename).
 * - If neither exists: clone from project.repo.
 * - If repo/ already exists: no-op.
 */
export function ensureProjectRepo(project: ProjectConfig): void {
  const repoDir = projectRepoDir(project.name);
  const legacyDir = path.join(projectDir(project.name), 'workspace');

  if (!fs.existsSync(repoDir) && fs.existsSync(legacyDir)) {
    fs.renameSync(legacyDir, repoDir);
    log.info('Migrated project workspace/ to repo/', { project: project.name });
    return;
  }

  if (fs.existsSync(repoDir)) return;

  fs.mkdirSync(repoDir, { recursive: true });
  const cloneArgs = [
    'clone',
    ...(project.clone_flags?.split(/\s+/).filter(Boolean) ?? []),
    project.repo,
    '.',
  ];
  const result = spawnSync('git', cloneArgs, { cwd: repoDir, encoding: 'utf-8' });
  if (result.status !== 0) {
    fs.rmSync(repoDir, { recursive: true, force: true });
    throw new Error(`Failed to clone ${project.repo}: ${result.stderr}`);
  }
  log.info('Cloned project repo', { project: project.name, repo: project.repo });
}

/**
 * Ensure a git worktree exists for the given yak.
 * Creates branch yak-{yakId} if it doesn't exist yet; checks it out if it does.
 * Returns the worktree directory path.
 */
export function ensureWorktree(project: ProjectConfig, yakId: string): string {
  const worktreeDir = projectWorktreeDir(project.name, yakId);
  if (fs.existsSync(worktreeDir)) return worktreeDir;

  const repoDir = projectRepoDir(project.name);
  const branchName = `yak-${safeId(yakId)}`;

  fs.mkdirSync(path.dirname(worktreeDir), { recursive: true });

  const branchCheck = spawnSync('git', ['branch', '--list', branchName], {
    cwd: repoDir,
    encoding: 'utf-8',
  });
  const branchExists = (branchCheck.stdout ?? '').trim().length > 0;

  const addArgs = ['worktree', 'add', worktreeDir, ...(branchExists ? [branchName] : ['-b', branchName])];
  const result = spawnSync('git', addArgs, { cwd: repoDir, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`Failed to create worktree for ${yakId}: ${result.stderr}`);
  }
  log.info('Created worktree', { project: project.name, yakId, branch: branchName });
  return worktreeDir;
}

/**
 * Remove a yak's git worktree. Safe to call if the worktree doesn't exist.
 * Falls back to manual directory removal if `git worktree remove` fails.
 */
export function removeWorktree(projectName: string, yakId: string): void {
  const worktreeDir = projectWorktreeDir(projectName, yakId);
  if (!fs.existsSync(worktreeDir)) return;

  const repoDir = projectRepoDir(projectName);
  if (!fs.existsSync(repoDir)) {
    fs.rmSync(worktreeDir, { recursive: true, force: true });
    return;
  }

  const result = spawnSync('git', ['worktree', 'remove', worktreeDir, '--force'], {
    cwd: repoDir,
    encoding: 'utf-8',
  });
  if (result.status !== 0) {
    log.warn('git worktree remove failed, removing directory manually', {
      projectName,
      yakId,
      stderr: result.stderr,
    });
    fs.rmSync(worktreeDir, { recursive: true, force: true });
    spawnSync('git', ['worktree', 'prune'], { cwd: repoDir });
  }
  log.info('Removed worktree', { projectName, yakId });
}
