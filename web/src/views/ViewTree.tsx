/**
 * Tree/browser presentation (calcifer-d720.3).
 *
 * An alternate list-level projection of an fs-backed view: instead of a flat
 * card list, it browses one folder at a time (subfolders + files, dirs first),
 * with a breadcrumb. The backend is identical to the wiki's — only the
 * presentation differs, which is the whole point of the `presentation` dimension.
 *
 * File behaviour by kind:
 *   folder       → descend (updates the `path` query param)
 *   .md / text   → open the document detail (prose primitive)
 *   other        → open inline via the byte endpoint; ⬇ forces a download
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchViewData, fileUrl, setAnnotation } from './api';
import type { QueryResult, Row, ViewManifest } from './types';

const TEXT_EXTS = new Set(['md', 'markdown', 'txt', 'text']);

function crumbs(path: string): Array<{ label: string; path: string }> {
  const out = [{ label: 'Home', path: '' }];
  if (!path) return out;
  const parts = path.split('/');
  let acc = '';
  for (const p of parts) {
    acc = acc ? `${acc}/${p}` : p;
    out.push({ label: p, path: acc });
  }
  return out;
}

function humanSize(n: unknown): string {
  const b = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(b) || b <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = b;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function ViewTree({ manifest }: { manifest: ViewManifest }) {
  const { view = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const [data, setData] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const path = sp.get('path') ?? '';
  const q = sp.get('q') ?? '';

  const load = useCallback(() => {
    let cancelled = false;
    fetchViewData(view, { browse: true, path: path || undefined, q: q || undefined, pageSize: 500 })
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError('Could not load this folder.'));
    return () => {
      cancelled = true;
    };
  }, [view, path, q]);

  useEffect(() => load(), [load]);

  function patch(next: Record<string, string | null>) {
    const merged = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') merged.delete(k);
      else merged.set(k, v);
    }
    setSp(merged, { replace: true });
  }

  async function toggleStar(row: Row) {
    const id = String(row[manifest.idField]);
    const starred = row._ann?.star === 'true';
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
  }

  if (error) return <div className="view-error">{error}</div>;

  return (
    <div className="view">
      <header className="view-header">
        <h1>{manifest.title}</h1>
        <div className="view-count">{data ? `${data.total} item${data.total === 1 ? '' : 's'}` : ''}</div>
      </header>

      <nav className="tree-crumbs">
        {crumbs(path).map((c, i, arr) => (
          <span key={c.path}>
            <button className="crumb" disabled={i === arr.length - 1} onClick={() => patch({ path: c.path || null })}>
              {c.label}
            </button>
            {i < arr.length - 1 && <span className="crumb-sep">/</span>}
          </span>
        ))}
      </nav>

      <div className="view-controls">
        <input
          className="view-search"
          placeholder="Filter this folder…"
          defaultValue={q}
          onKeyDown={(e) => {
            if (e.key === 'Enter') patch({ q: (e.target as HTMLInputElement).value || null });
          }}
        />
      </div>

      <ul className="tree-list">
        {data?.items.map((row) => {
          const rowPath = String(row.path);
          const name = String(row.name);
          const isDir = row.kind === 'dir';
          const ext = String(row.ext ?? '');
          const starred = row._ann?.star === 'true';
          return (
            <li key={rowPath} className="tree-row">
              <button className={`tree-star ${starred ? 'starred' : ''}`} title="Star" onClick={() => toggleStar(row)}>
                {starred ? '★' : '☆'}
              </button>
              {isDir ? (
                <button className="tree-name" onClick={() => patch({ path: rowPath, q: null })}>
                  <span className="tree-icon">📁</span>
                  {name}
                </button>
              ) : TEXT_EXTS.has(ext) ? (
                <Link className="tree-name" to={`/app/${view}/${encodeURIComponent(rowPath)}`}>
                  <span className="tree-icon">📄</span>
                  {name}
                </Link>
              ) : (
                <a className="tree-name" href={fileUrl(view, rowPath)} target="_blank" rel="noreferrer noopener">
                  <span className="tree-icon">📄</span>
                  {name}
                </a>
              )}
              <span className="tree-meta">{isDir ? '' : humanSize(row.size)}</span>
              {!isDir && (
                <a className="tree-dl" href={fileUrl(view, rowPath, true)} title="Download">
                  ⬇
                </a>
              )}
            </li>
          );
        })}
        {data && data.items.length === 0 && <li className="tree-empty">Empty folder.</li>}
      </ul>
    </div>
  );
}
