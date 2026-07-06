/** List view: collection tabs + search + filters + cards + pagination (calcifer-1d51.4). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchManifest, fetchViewData, setAnnotation } from './api';
import { Filters } from './Filters';
import { interpolate, truthyToken } from './primitives';
import type { ActionSpec, FilterState, QueryResult, Row, ViewManifest } from './types';

function parseFilters(raw: string | null): FilterState {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as FilterState;
  } catch {
    return {};
  }
}

export function ViewList() {
  const { view = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const [manifest, setManifest] = useState<ViewManifest | null>(null);
  const [data, setData] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const collection = sp.get('collection') ?? undefined;
  const q = sp.get('q') ?? '';
  const sort = sp.get('sort') ?? undefined;
  const page = parseInt(sp.get('page') ?? '1', 10) || 1;
  const filters = useMemo(() => parseFilters(sp.get('f')), [sp]);

  useEffect(() => {
    let cancelled = false;
    fetchManifest(view)
      .then((m) => !cancelled && setManifest(m))
      .catch(() => !cancelled && setError('Could not load this view.'));
    return () => {
      cancelled = true;
    };
  }, [view]);

  const load = useCallback(() => {
    let cancelled = false;
    fetchViewData(view, { collection, q: q || undefined, sort, page, filters })
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError('Could not load data.'));
    return () => {
      cancelled = true;
    };
  }, [view, collection, q, sort, page, filters]);

  useEffect(() => load(), [load]);

  function patch(next: Record<string, string | null>, resetPage = true) {
    const merged = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') merged.delete(k);
      else merged.set(k, v);
    }
    if (resetPage) merged.delete('page');
    setSp(merged, { replace: true });
  }

  async function toggleStar(row: Row) {
    if (!manifest) return;
    const id = String(row[manifest.idField]);
    const starred = row._ann?.star === 'true';
    // optimistic
    setData((d) =>
      d
        ? {
            ...d,
            items: d.items.map((r) =>
              String(r[manifest.idField]) === id ? { ...r, _ann: { ...r._ann, star: starred ? '' : 'true' } } : r,
            ),
          }
        : d,
    );
    await setAnnotation(view, id, 'star', starred ? null : 'true');
    if (collection === 'starred') load(); // dropped from the starred list
  }

  if (error) return <div className="view-error">{error}</div>;
  if (!manifest) return <div className="view-loading">Loading…</div>;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="view">
      <header className="view-header">
        <h1>{manifest.title}</h1>
        <div className="view-count">{data ? `${data.total} result${data.total === 1 ? '' : 's'}` : ''}</div>
      </header>

      {manifest.collections && (
        <nav className="collection-tabs">
          <button className={!collection ? 'active' : ''} onClick={() => patch({ collection: null })}>
            All
          </button>
          {Object.entries(manifest.collections).map(([key, c]) => (
            <button key={key} className={collection === key ? 'active' : ''} onClick={() => patch({ collection: key })}>
              {c.label}
            </button>
          ))}
        </nav>
      )}

      <div className="view-controls">
        <input
          className="view-search"
          placeholder="Search…"
          defaultValue={q}
          onKeyDown={(e) => {
            if (e.key === 'Enter') patch({ q: (e.target as HTMLInputElement).value });
          }}
        />
        <SortControl manifest={manifest} sort={sort} onChange={(s) => patch({ sort: s })} />
      </div>

      <div className="view-body">
        <aside className="view-filters">
          <Filters
            manifest={manifest}
            facets={data?.facets}
            value={filters}
            onChange={(f) => patch({ f: Object.keys(f).length ? JSON.stringify(f) : null })}
          />
        </aside>

        <div className="view-list">
          {data?.items.length === 0 && <div className="view-empty">Nothing here yet.</div>}
          {data?.items.map((row) => (
            <Card key={String(row[manifest.idField])} manifest={manifest} row={row} onStar={() => toggleStar(row)} />
          ))}

          {data && data.total > data.pageSize && (
            <div className="pager">
              <button disabled={page <= 1} onClick={() => patch({ page: String(page - 1) }, false)}>
                ← Prev
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => patch({ page: String(page + 1) }, false)}>
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SortControl({
  manifest,
  sort,
  onChange,
}: {
  manifest: ViewManifest;
  sort: string | undefined;
  onChange: (s: string | null) => void;
}) {
  const sortable = Object.entries(manifest.fields).filter(([, s]) => s.sort);
  if (sortable.length === 0) return null;
  return (
    <select className="view-sort" value={sort ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Sort: default</option>
      {sortable.map(([name, s]) => [
        <option key={name} value={name}>
          {s.label ?? name} ↑
        </option>,
        <option key={`-${name}`} value={`-${name}`}>
          {s.label ?? name} ↓
        </option>,
      ])}
    </select>
  );
}

function Card({ manifest, row, onStar }: { manifest: ViewManifest; row: Row; onStar: () => void }) {
  const card = manifest.list.card;
  const id = String(row[manifest.idField]);
  const starred = row._ann?.star === 'true';
  const hasStar = manifest.annotations?.includes('star');

  return (
    <div className="card">
      <Link className="card-main" to={`/app/${manifest.view}/${encodeURIComponent(id)}`}>
        <div className="card-title">{interpolate(card.title, row)}</div>
        {card.subtitle && <div className="card-subtitle">{interpolate(card.subtitle, row)}</div>}
        {card.badges && (
          <div className="card-badges">
            {card.badges
              .filter((b) => truthyToken(b.when, row))
              .map((b, i) => (
                <span className="v-badge" key={i}>
                  {interpolate(b.label, row)}
                </span>
              ))}
          </div>
        )}
      </Link>
      <div className="card-actions">
        {hasStar && (
          <button className={`icon-button ${starred ? 'starred' : ''}`} title="Star" onClick={onStar}>
            {starred ? '★' : '☆'}
          </button>
        )}
        {(card.actions ?? []).map((a, i) => (
          <CardAction key={i} action={a} row={row} />
        ))}
      </div>
    </div>
  );
}

function CardAction({ action, row }: { action: ActionSpec; row: Row }) {
  if (typeof action === 'string') return null; // "star" handled above
  if (action.type === 'open' && action.href) {
    const href = interpolate(action.href, row);
    if (!href) return null;
    return (
      <a className="icon-button" href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        {action.label ?? 'Open'} ↗
      </a>
    );
  }
  return null; // other action types (ask, navigate) land in 1d51.6
}
