import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { fetchHistory } from '../runtime';
import { scoreMatch } from './match';
import type { ViewSummary } from '../views/types';

/**
 * Command palette (calcifer-c170 / A4). A keyboard-first overlay (Cmd/Ctrl+K)
 * that fuzzy-searches across conversations (by their B0 titles) and app views,
 * and jumps on Enter. Shares its matcher with the archive-browser search
 * (./match). Purely a navigation surface — it mutates nothing but the selected
 * thread / route.
 */
type Item =
  | { kind: 'new' }
  | { kind: 'thread'; id: string; label: string }
  | { kind: 'view'; view: string; label: string };

const NEW_LABEL = 'New chat';

function labelOf(it: Item): string {
  return it.kind === 'new' ? NEW_LABEL : it.label;
}

function iconOf(it: Item): string {
  return it.kind === 'new' ? '＋' : it.kind === 'thread' ? '💬' : '▸';
}

function kindOf(it: Item): string {
  return it.kind === 'new' ? 'Action' : it.kind === 'thread' ? 'Chat' : 'App';
}

export function CommandPalette({
  open,
  onClose,
  views,
}: {
  open: boolean;
  onClose: () => void;
  views: ViewSummary[];
}) {
  const navigate = useNavigate();
  const threadIds = useStore((s) => s.threadIds);
  const titles = useStore((s) => s.titles);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Fresh query + selection each time it opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setSel(0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      { kind: 'new' },
      ...threadIds.map((id): Item => ({ kind: 'thread', id, label: titles[id] || NEW_LABEL })),
      ...views.map((v): Item => ({ kind: 'view', view: v.view, label: v.title })),
    ];
    const q = query.trim();
    if (!q) return all;
    return all
      .map((it) => ({ it, score: scoreMatch(labelOf(it), q) }))
      .filter((x): x is { it: Item; score: number } => x.score !== null)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.it);
  }, [query, threadIds, titles, views]);

  // Keep the selection in range as the result set shrinks/grows.
  useEffect(() => {
    setSel((s) => Math.min(s, Math.max(0, items.length - 1)));
  }, [items.length]);

  // Keep the highlighted row visible during arrow-key navigation.
  useEffect(() => {
    listRef.current?.querySelector('.cmdk-item.sel')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;

  const activate = (it: Item) => {
    onClose();
    if (it.kind === 'new') {
      useStore.getState().createThread();
      navigate('/');
    } else if (it.kind === 'thread') {
      useStore.getState().setCurrentThreadId(it.id);
      void fetchHistory(it.id);
      navigate('/');
    } else {
      navigate(`/app/${it.view}`);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Arrow keys plus the TUI/readline home-row bindings: Ctrl-N = next,
    // Ctrl-P = previous.
    const next = e.key === 'ArrowDown' || (e.ctrlKey && (e.key === 'n' || e.key === 'N'));
    const prev = e.key === 'ArrowUp' || (e.ctrlKey && (e.key === 'p' || e.key === 'P'));
    if (next) {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, items.length - 1));
    } else if (prev) {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = items[sel];
      if (it) activate(it);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="cmdk-overlay" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="cmdk-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="cmdk-panel">
        <input
          className="cmdk-input"
          type="text"
          placeholder="Search conversations and apps…"
          value={query}
          autoFocus
          onChange={(e) => {
            setQuery(e.target.value);
            setSel(0);
          }}
          onKeyDown={onKeyDown}
        />
        <ul className="cmdk-list" ref={listRef}>
          {items.length === 0 ? (
            <li className="cmdk-empty">No matches.</li>
          ) : (
            items.map((it, i) => (
              <li
                key={it.kind === 'thread' ? `t:${it.id}` : it.kind === 'view' ? `v:${it.view}` : 'new'}
                className={`cmdk-item ${i === sel ? 'sel' : ''}`}
                onMouseEnter={() => setSel(i)}
                // mousedown (not click) so activation fires before the input blurs.
                onMouseDown={(e) => {
                  e.preventDefault();
                  activate(it);
                }}
              >
                <span className="cmdk-icon">{iconOf(it)}</span>
                <span className="cmdk-label">{labelOf(it)}</span>
                <span className="cmdk-kind">{kindOf(it)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
