import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

export const migration014: Migration = {
  version: 14,
  name: 'project-system',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_runs (
        id               TEXT PRIMARY KEY,
        project_name     TEXT NOT NULL,
        yak_id           TEXT,
        status           TEXT NOT NULL DEFAULT 'running',
        session_id       TEXT,
        initiated_by_jid TEXT,
        container_name   TEXT,
        result           TEXT,
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_project_runs_project_name ON project_runs(project_name);
      CREATE INDEX IF NOT EXISTS idx_project_runs_status ON project_runs(status);

      CREATE TABLE IF NOT EXISTS serve_runs (
        id            TEXT PRIMARY KEY,
        project_name  TEXT NOT NULL,
        project_id    TEXT,
        container_name TEXT NOT NULL,
        host_port     INTEGER NOT NULL,
        serve_port    INTEGER NOT NULL,
        serve_cmd     TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'serving',
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_serve_runs_project_name ON serve_runs(project_name);
    `);
  },
};
