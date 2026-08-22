import type { Migration } from './index.js';

/**
 * Shared annotations for skill-view entities (calcifer-1d51.1).
 *
 * User-facing UI state (star, read, notes, …) layered on top of skill-owned
 * facts (e.g. nyc-apt's listings.db). Host-owned so the skill's fact DB stays
 * single-writer. Deliberately NOT keyed by user — Calcifer is family-shared, so
 * one starred apartment is starred for everyone. `value` is a stringified scalar
 * (e.g. 'true' for a star, free text for a note).
 *
 * NOTE: renumbered from 017 → 025 during the v2.2.0 upstream merge (upstream
 * took 016–023). The applied identity is `name` ('annotations'), which is
 * unchanged, so already-migrated DBs are unaffected; only the file/symbol
 * number moved to avoid colliding with upstream's 017.
 */
export const migration025: Migration = {
  version: 25,
  name: 'annotations',
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS annotations (
        skill       TEXT NOT NULL,
        entity_id   TEXT NOT NULL,
        key         TEXT NOT NULL,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        PRIMARY KEY (skill, entity_id, key)
      );
      CREATE INDEX IF NOT EXISTS idx_annotations_lookup ON annotations(skill, key);
    `);
  },
};
