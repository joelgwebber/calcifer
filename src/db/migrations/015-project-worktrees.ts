import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

export const migration015: Migration = {
  version: 15,
  name: 'project-worktrees',
  up(db: Database.Database) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_project_runs_project_yak ON project_runs(project_name, yak_id);
    `);
  },
};
