import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { fetchHistory } from '../runtime';
import { archiveThread, pinThread, renameThread } from '../threads-api';

/**
 * The active conversation list (calcifer-3d5f / B5). Store-driven rather than
 * assistant-ui's flat ThreadListPrimitive, because we interleave time-bucket
 * headers (Pinned / Today / Yesterday / Previous 7 days / Older) that a flat
 * item list can't express. Switching sets currentThreadId in the store (the
 * ExternalStore runtime derives its view from it) and hydrates history.
 *
 * Each row's ⋯ menu carries Pin/Unpin (B5), Rename (B1), and Archive (B2), all
 * driven through the store + thread_meta endpoints so they survive reload and
 * are shared family-wide.
 */
export function ThreadList() {
  const threadIds = useStore((s) => s.threadIds);
  const titles = useStore((s) => s.titles);
  const lastActive = useStore((s) => s.lastActive);
  const pinned = useStore((s) => s.pinned);
  const createThread = useStore((s) => s.createThread);

  const buckets = useMemo(
    () => bucketize(threadIds, lastActive, pinned),
    [threadIds, lastActive, pinned],
  );

  return (
    <div className="thread-list">
      <button className="thread-list-new" onClick={() => createThread()}>
        + New chat
      </button>
      <div className="thread-list-items">
        {buckets.map((b) => (
          <div className="thread-bucket" key={b.key}>
            <div className="thread-bucket-label">{b.label}</div>
            {b.ids.map((id) => (
              <ThreadRow key={id} id={id} title={titles[id]} pinned={!!pinned[id]} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ThreadRow({ id, title, pinned }: { id: string; title: string; pinned: boolean }) {
  const currentThreadId = useStore((s) => s.currentThreadId);
  const active = currentThreadId === id;

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const select = () => {
    useStore.getState().setCurrentThreadId(id);
    void fetchHistory(id);
  };

  const startRename = () => {
    setDraft(useStore.getState().titles[id] ?? '');
    setEditing(true);
    setMenuOpen(false);
  };
  const commitRename = () => {
    const next = draft.trim();
    if (next) {
      useStore.getState().renameThread(id, next);
      void renameThread(id, next);
    }
    setEditing(false);
  };

  const togglePin = () => {
    setMenuOpen(false);
    const next = !pinned;
    useStore.getState().setPinned(id, next);
    void pinThread(id, next);
  };

  const archive = () => {
    setMenuOpen(false);
    useStore.getState().deleteThread(id);
    void archiveThread(id, true);
  };

  if (editing) {
    return (
      <div className="thread-list-item">
        <input
          className="thread-rename-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            else if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={commitRename}
        />
      </div>
    );
  }

  return (
    <div className="thread-list-item" data-active={active}>
      <button className="thread-list-item-trigger" onClick={select}>
        {pinned && <span className="thread-pin-dot" aria-label="Pinned" title="Pinned">📌</span>}
        {title || 'New chat'}
      </button>
      <button
        className="thread-item-menu-btn"
        aria-label="Conversation options"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((o) => !o);
        }}
      >
        ⋯
      </button>
      {menuOpen && (
        <>
          <div className="thread-item-menu-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="thread-item-menu" role="menu">
            <button className="thread-item-menu-action" role="menuitem" onClick={togglePin}>
              {pinned ? 'Unpin' : 'Pin'}
            </button>
            <button className="thread-item-menu-action" role="menuitem" onClick={startRename}>
              Rename
            </button>
            <button className="thread-item-menu-action" role="menuitem" onClick={archive}>
              Archive
            </button>
          </div>
        </>
      )}
    </div>
  );
}

type Bucket = { key: string; label: string; ids: string[] };

/**
 * Partition active threads into pinned + calendar-relative time buckets, each
 * sorted newest-first. Pinned threads leave the time buckets entirely and float
 * to their own section at the top. Empty buckets are dropped.
 */
function bucketize(
  ids: string[],
  lastActive: Record<string, number>,
  pinned: Record<string, boolean>,
): Bucket[] {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const today = startToday.getTime();
  const yesterday = today - 86_400_000;
  const week = today - 7 * 86_400_000;

  const pinnedIds: string[] = [];
  const todayIds: string[] = [];
  const yesterdayIds: string[] = [];
  const weekIds: string[] = [];
  const olderIds: string[] = [];

  for (const id of ids) {
    if (pinned[id]) {
      pinnedIds.push(id);
      continue;
    }
    const t = lastActive[id] ?? 0;
    if (t >= today) todayIds.push(id);
    else if (t >= yesterday) yesterdayIds.push(id);
    else if (t >= week) weekIds.push(id);
    else olderIds.push(id);
  }

  const byRecency = (a: string, b: string) => (lastActive[b] ?? 0) - (lastActive[a] ?? 0);
  const buckets: Bucket[] = [
    { key: 'pinned', label: 'Pinned', ids: pinnedIds },
    { key: 'today', label: 'Today', ids: todayIds },
    { key: 'yesterday', label: 'Yesterday', ids: yesterdayIds },
    { key: 'week', label: 'Previous 7 days', ids: weekIds },
    { key: 'older', label: 'Older', ids: olderIds },
  ];
  for (const b of buckets) b.ids.sort(byRecency);
  return buckets.filter((b) => b.ids.length > 0);
}
