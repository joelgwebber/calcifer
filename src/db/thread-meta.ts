/**
 * Per-conversation (web thread) metadata — title overrides, archive state, and
 * pin/order/folder reserves (calcifer-3236 / web overhaul B0). See migration
 * 026-thread-metadata.
 *
 * Host-owned and family-shared (NOT per-user), keyed on (messaging_group_id,
 * thread_id). The web thread list (web-history.ts listThreads) merges the title
 * override and filters archived threads out; the rename / archive / unarchive
 * endpoints write here. Every mutation is an upsert so a thread gets a metadata
 * row the first time it's renamed/archived/pinned and not before.
 */
import { getDb } from './connection.js';

export interface ThreadMeta {
  messaging_group_id: string;
  thread_id: string;
  /** Nullable override; null → fall back to the first-message title. */
  title: string | null;
  /** ISO-8601 UTC when archived; null → active. */
  archived_at: string | null;
  pinned: boolean;
  sort_order: number | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ThreadMetaRow {
  messaging_group_id: string;
  thread_id: string;
  title: string | null;
  archived_at: string | null;
  pinned: number;
  sort_order: number | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

function hydrate(r: ThreadMetaRow): ThreadMeta {
  return { ...r, pinned: r.pinned !== 0 };
}

/** Metadata for one thread, or null if none has been set. */
export async function getThreadMeta(mgId: string, threadId: string): Promise<ThreadMeta | null> {
  const row = await getDb().get<ThreadMetaRow>(
    'SELECT * FROM thread_meta WHERE messaging_group_id = ? AND thread_id = ?',
    mgId,
    threadId,
  );
  return row ? hydrate(row) : null;
}

/**
 * Metadata for a set of threads on one group, keyed by thread_id. Threads with
 * no metadata row are simply absent from the map (the listThreads merge treats
 * that as "no override, active, unpinned").
 */
export async function getThreadMetaFor(mgId: string, threadIds: string[]): Promise<Map<string, ThreadMeta>> {
  const out = new Map<string, ThreadMeta>();
  if (threadIds.length === 0) return out;
  const placeholders = threadIds.map(() => '?').join(',');
  const rows = await getDb().all<ThreadMetaRow>(
    `SELECT * FROM thread_meta WHERE messaging_group_id = ? AND thread_id IN (${placeholders})`,
    mgId,
    ...threadIds,
  );
  for (const r of rows) out.set(r.thread_id, hydrate(r));
  return out;
}

/** thread_ids on this group that are currently archived. */
export async function getArchivedThreadIds(mgId: string): Promise<Set<string>> {
  const rows = await getDb().all<{ thread_id: string }>(
    'SELECT thread_id FROM thread_meta WHERE messaging_group_id = ? AND archived_at IS NOT NULL',
    mgId,
  );
  return new Set(rows.map((r) => r.thread_id));
}

/** Set (or clear, with null) the title override — leaves archive/pin state intact. */
export async function setThreadTitle(mgId: string, threadId: string, title: string | null): Promise<void> {
  const now = new Date().toISOString();
  await getDb().run(
    `INSERT INTO thread_meta (messaging_group_id, thread_id, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(messaging_group_id, thread_id)
       DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at`,
    mgId,
    threadId,
    title,
    now,
    now,
  );
}

/** Archive (archived=true) or rescue (archived=false) — leaves title/pin intact. */
export async function setThreadArchived(mgId: string, threadId: string, archived: boolean): Promise<void> {
  const now = new Date().toISOString();
  await getDb().run(
    `INSERT INTO thread_meta (messaging_group_id, thread_id, archived_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(messaging_group_id, thread_id)
       DO UPDATE SET archived_at = excluded.archived_at, updated_at = excluded.updated_at`,
    mgId,
    threadId,
    archived ? now : null,
    now,
    now,
  );
}

/** Pin or unpin a thread (reserved for B5 — pin/bucketing) — leaves title/archive intact. */
export async function setThreadPinned(mgId: string, threadId: string, pinned: boolean): Promise<void> {
  const now = new Date().toISOString();
  await getDb().run(
    `INSERT INTO thread_meta (messaging_group_id, thread_id, pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(messaging_group_id, thread_id)
       DO UPDATE SET pinned = excluded.pinned, updated_at = excluded.updated_at`,
    mgId,
    threadId,
    pinned ? 1 : 0,
    now,
    now,
  );
}
