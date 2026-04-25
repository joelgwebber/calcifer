import { getDb } from './connection.js';

export interface ProjectRun {
  id: string;
  project_name: string;
  yak_id: string | null;
  status: 'running' | 'done' | 'failed' | 'abandoned';
  session_id: string | null;
  initiated_by_jid: string | null;
  container_name: string | null;
  result: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServeRun {
  id: string;
  project_name: string;
  project_id: string | null;
  container_name: string;
  host_port: number;
  serve_port: number;
  serve_cmd: string;
  status: 'serving' | 'stopped';
  created_at: string;
  updated_at: string;
}

export function createProjectRun(run: Pick<ProjectRun, 'id' | 'project_name' | 'yak_id' | 'initiated_by_jid'>): void {
  getDb()
    .prepare(
      `INSERT INTO project_runs (id, project_name, yak_id, initiated_by_jid)
       VALUES (?, ?, ?, ?)`,
    )
    .run(run.id, run.project_name, run.yak_id ?? null, run.initiated_by_jid ?? null);
}

export function updateProjectRun(
  id: string,
  updates: Partial<Pick<ProjectRun, 'status' | 'session_id' | 'container_name' | 'result'>>,
): void {
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.session_id !== undefined) { fields.push('session_id = ?'); values.push(updates.session_id); }
  if (updates.container_name !== undefined) { fields.push('container_name = ?'); values.push(updates.container_name); }
  if (updates.result !== undefined) { fields.push('result = ?'); values.push(updates.result); }

  values.push(id);
  getDb().prepare(`UPDATE project_runs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function getActiveProjectRun(projectName: string): ProjectRun | undefined {
  return getDb()
    .prepare(`SELECT * FROM project_runs WHERE project_name = ? AND status = 'running' ORDER BY created_at DESC LIMIT 1`)
    .get(projectName) as ProjectRun | undefined;
}

export function getLatestProjectRun(projectName: string): ProjectRun | undefined {
  return getDb()
    .prepare(`SELECT * FROM project_runs WHERE project_name = ? ORDER BY created_at DESC LIMIT 1`)
    .get(projectName) as ProjectRun | undefined;
}

export function createServeRun(
  run: Pick<ServeRun, 'id' | 'project_name' | 'project_id' | 'container_name' | 'host_port' | 'serve_port' | 'serve_cmd'>,
): void {
  getDb()
    .prepare(
      `INSERT INTO serve_runs (id, project_name, project_id, container_name, host_port, serve_port, serve_cmd)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(run.id, run.project_name, run.project_id ?? null, run.container_name, run.host_port, run.serve_port, run.serve_cmd);
}

export function updateServeRun(id: string, updates: Partial<Pick<ServeRun, 'status' | 'container_name'>>): void {
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.container_name !== undefined) { fields.push('container_name = ?'); values.push(updates.container_name); }

  values.push(id);
  getDb().prepare(`UPDATE serve_runs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function getActiveServeRun(projectName: string): ServeRun | undefined {
  return getDb()
    .prepare(`SELECT * FROM serve_runs WHERE project_name = ? AND status = 'serving' ORDER BY created_at DESC LIMIT 1`)
    .get(projectName) as ServeRun | undefined;
}
