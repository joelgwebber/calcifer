import type { Migration } from './index.js';

/**
 * Per-conversation (web thread) metadata (calcifer-3236 / web overhaul B0).
 *
 * Today web thread titles are recomputed from each thread's first user message
 * on every load (see web-history.ts listThreads), and the client store's
 * rename/delete are in-memory only — clobbered by hydrateThreadList on reload.
 * This table is the host-owned persistence that rename + archive build on.
 *
 * Keyed on (messaging_group_id, thread_id) — the stable identity of a web
 * conversation (a per-thread session's thread_id within one web messaging
 * group). Like `annotations` it is deliberately NOT keyed by user: Calcifer is
 * family-shared, so a renamed/archived conversation is renamed/archived for
 * everyone on that group.
 *
 * `title` is a nullable OVERRIDE (null → fall back to the first-message title).
 * `archived_at` null → active. `pinned`, `sort_order`, and `folder_id` are
 * reserved now (columns are free) so B5 (pin/bucketing) and the future project
 * grouping + hosted-artifacts direction don't require a second migration.
 */
export const migration026: Migration = {
  version: 26,
  name: 'thread-metadata',
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS thread_meta (
        messaging_group_id  TEXT NOT NULL,
        thread_id           TEXT NOT NULL,
        title               TEXT,
        archived_at         TEXT,
        pinned              INTEGER NOT NULL DEFAULT 0,
        sort_order          INTEGER,
        folder_id           TEXT,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL,
        PRIMARY KEY (messaging_group_id, thread_id)
      );
      CREATE INDEX IF NOT EXISTS idx_thread_meta_active ON thread_meta(messaging_group_id, archived_at);
    `);
  },
};
