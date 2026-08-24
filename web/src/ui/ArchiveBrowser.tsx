import { useEffect, useMemo, useState } from 'react';
import { fetchArchivedThreads, archiveThread as archiveThreadApi, type ArchivedThread } from '../threads-api';
import { useStore } from '../store';

/**
 * Archived-conversation browser (calcifer-d029 / B3 + calcifer-77be / B4). Opens
 * as a modal over the shell; lists soft-deleted threads from the host with a
 * client-side name filter, and rescues one back into the active rail. Archive is
 * a soft-delete (B2), so this is the only way back — the row's Rescue action
 * clears archived_at via the same endpoint and drops the thread into the store.
 */
export function ArchiveBrowser({ open, onClose }: { open: boolean; onClose: () => void }) {
  const restoreThread = useStore((s) => s.restoreThread);
  const [threads, setThreads] = useState<ArchivedThread[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // (Re)load the archived list each time the browser opens; reset the filter.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setQuery('');
    void fetchArchivedThreads().then((list) => {
      if (!cancelled) {
        setThreads(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => (t.title || 'New chat').toLowerCase().includes(q));
  }, [threads, query]);

  if (!open) return null;

  const rescue = (t: ArchivedThread) => {
    // Optimistic: pull it out of the archived list, drop it back into the rail,
    // then persist the rescue. On failure it simply reappears here on next open.
    setThreads((prev) => prev.filter((x) => x.threadId !== t.threadId));
    restoreThread(t.threadId, t.title);
    void archiveThreadApi(t.threadId, false);
  };

  return (
    <div className="archive-overlay" role="dialog" aria-modal="true" aria-label="Archived conversations">
      <div className="archive-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="archive-panel">
        <div className="archive-head">
          <h2 className="archive-title">Archived conversations</h2>
          <button className="archive-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <input
          className="archive-search"
          type="search"
          placeholder="Filter by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className="archive-list">
          {loading ? (
            <div className="archive-empty">Loading…</div>
          ) : threads.length === 0 ? (
            <div className="archive-empty">Nothing archived yet.</div>
          ) : filtered.length === 0 ? (
            <div className="archive-empty">No conversations match “{query}”.</div>
          ) : (
            filtered.map((t) => (
              <div className="archive-row" key={t.threadId}>
                <div className="archive-row-main">
                  <span className="archive-row-title">{t.title || 'New chat'}</span>
                  <span className="archive-row-date">{formatLastActive(t.lastActive)}</span>
                </div>
                <button className="archive-rescue" onClick={() => rescue(t)}>
                  Rescue
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Compact "last active" label: time today, weekday this week, else a date. */
function formatLastActive(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (daysAgo < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
