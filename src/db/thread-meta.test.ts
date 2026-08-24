/**
 * thread_meta persistence (calcifer-3236 / web overhaul B0).
 *
 * Guarantees the listThreads merge + rename/archive endpoints rely on:
 *   - upserts are field-scoped (a rename never disturbs archive state, etc.);
 *   - archive/rescue is reversible and reflected in getArchivedThreadIds;
 *   - everything is scoped by messaging_group_id.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { initTestDb, closeDb } from './connection.js';
import { runMigrations } from './migrations/index.js';
import {
  getThreadMeta,
  getThreadMetaFor,
  getArchivedThreadIds,
  setThreadTitle,
  setThreadArchived,
  setThreadPinned,
} from './thread-meta.js';

const MG = 'mg-web-1';

describe('thread_meta', () => {
  beforeEach(async () => {
    const db = await initTestDb();
    await runMigrations(db);
  });
  afterEach(async () => {
    await closeDb();
  });

  it('returns null for a thread with no metadata', async () => {
    expect(await getThreadMeta(MG, 't1')).toBeNull();
  });

  it('renames without disturbing archive state, and clears the override with null', async () => {
    await setThreadArchived(MG, 't1', true);
    await setThreadTitle(MG, 't1', 'Renamed');
    let m = await getThreadMeta(MG, 't1');
    expect(m?.title).toBe('Renamed');
    expect(m?.archived_at).not.toBeNull(); // archive survives a rename

    await setThreadTitle(MG, 't1', null);
    m = await getThreadMeta(MG, 't1');
    expect(m?.title).toBeNull();
    expect(m?.archived_at).not.toBeNull();
  });

  it('archives and rescues reversibly', async () => {
    await setThreadArchived(MG, 't1', true);
    expect(await getArchivedThreadIds(MG)).toEqual(new Set(['t1']));

    await setThreadArchived(MG, 't1', false);
    expect(await getArchivedThreadIds(MG)).toEqual(new Set());
    expect((await getThreadMeta(MG, 't1'))?.archived_at).toBeNull();
  });

  it('scopes by messaging group and batch-fetches', async () => {
    await setThreadTitle(MG, 't1', 'A');
    await setThreadTitle(MG, 't2', 'B');
    await setThreadTitle('mg-other', 't1', 'X');

    const map = await getThreadMetaFor(MG, ['t1', 't2', 't3']);
    expect(map.get('t1')?.title).toBe('A');
    expect(map.get('t2')?.title).toBe('B');
    expect(map.has('t3')).toBe(false); // no row → absent
    expect(map.size).toBe(2);
  });

  it('pins and unpins (reserved for B5)', async () => {
    await setThreadPinned(MG, 't1', true);
    expect((await getThreadMeta(MG, 't1'))?.pinned).toBe(true);
    await setThreadPinned(MG, 't1', false);
    expect((await getThreadMeta(MG, 't1'))?.pinned).toBe(false);
  });
});
