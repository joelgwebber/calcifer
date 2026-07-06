import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

/**
 * Shared annotations for skill-view entities (calcifer-1d51.1).
 *
 * User-facing UI state (star, read, notes, …) layered on top of skill-owned
 * facts (e.g. nyc-apt's listings.db). Host-owned so the skill's fact DB stays
 * single-writer. Deliberately NOT keyed by user — Calcifer is family-shared, so
 * one starred apartment is starred for everyone. `value` is a stringified scalar
 * (e.g. 'true' for a star, free text for a note).
 */
export const migration017: Migration = {
  version: 17,
  name: 'annotations',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE annotations (
        skill       TEXT NOT NULL,
        entity_id   TEXT NOT NULL,
        key         TEXT NOT NULL,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        PRIMARY KEY (skill, entity_id, key)
      );
      CREATE INDEX idx_annotations_lookup ON annotations(skill, key);
    `);
  },
};
