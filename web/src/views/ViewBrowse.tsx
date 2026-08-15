/**
 * Browse presentations (calcifer-d720.3 / library exploration).
 *
 * One component, two layouts over the SAME fs browse backend:
 *   presentation="tree"    → a dirs-first row list (documents, books)
 *   presentation="gallery" → a thumbnail grid (pictures)
 * Folder navigation, search, stars, and open/download are shared; only the tile
 * rendering differs. This is the payoff of decoupling presentation from source.
 *
 * NOTE: gallery thumbnails are the full images served by the byte endpoint
 * (lazy-loaded). Server-side thumbnailing is a future optimization (see yaks).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchViewData, fileUrl, setAnnotation } from './api';
import type { QueryResult, Row, ViewManifest } from './types';

const TEXT_EXTS = new Set(['md', 'markdown', 'txt', 'text']);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

function crumbs(path: string): Array<{ label: string; path: string }> {
  const out = [{ label: 'Home', path: '' }];
  if (!path) return out;
  let acc = '';
  for (const p of path.split('/')) {
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

export function ViewBrowse({ manifest }: { manifest: ViewManifest }) {
  const { view = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const [data, setData] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gallery = manifest.presentation === 'gallery';
  const path = sp.get('path') ?? '';
  const q = sp.get('q') ?? '';

  const load = useCallback(() => {
    let cancelled = false;
    fetchViewData(view, { browse: true, path: path || undefined, q: q || undefined, pageSize: 1000 })
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

      {gallery ? (
        <div className="gallery-grid">
          {data?.items.map((row) => (
            <GalleryTile key={String(row.path)} view={view} row={row} onDescend={(p) => patch({ path: p, q: null })} onStar={() => toggleStar(row)} />
          ))}
          {data && data.items.length === 0 && <div className="tree-empty">Empty folder.</div>}
        </div>
      ) : (
        <ul className="tree-list">
          {data?.items.map((row) => (
            <TreeRow key={String(row.path)} view={view} row={row} onDescend={(p) => patch({ path: p, q: null })} onStar={() => toggleStar(row)} />
          ))}
          {data && data.items.length === 0 && <li className="tree-empty">Empty folder.</li>}
        </ul>
      )}
    </div>
  );
}

function FileName({ view, row, children }: { view: string; row: Row; children: React.ReactNode }) {
  const rowPath = String(row.path);
  const ext = String(row.ext ?? '');
  if (TEXT_EXTS.has(ext)) {
    return (
      <Link className="tree-name" to={`/app/${view}/${encodeURIComponent(rowPath)}`}>
        {children}
      </Link>
    );
  }
  return (
    <a className="tree-name" href={fileUrl(view, rowPath)} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

function TreeRow({ view, row, onDescend, onStar }: { view: string; row: Row; onDescend: (p: string) => void; onStar: () => void }) {
  const rowPath = String(row.path);
  const name = String(row.name);
  const isDir = row.kind === 'dir';
  const starred = row._ann?.star === 'true';
  return (
    <li className="tree-row">
      <button className={`tree-star ${starred ? 'starred' : ''}`} title="Star" onClick={onStar}>
        {starred ? '★' : '☆'}
      </button>
      {isDir ? (
        <button className="tree-name" onClick={() => onDescend(rowPath)}>
          <span className="tree-icon">📁</span>
          {name}
        </button>
      ) : (
        <FileName view={view} row={row}>
          <span className="tree-icon">📄</span>
          {name}
        </FileName>
      )}
      <span className="tree-meta">{isDir ? '' : humanSize(row.size)}</span>
      {!isDir && (
        <a className="tree-dl" href={fileUrl(view, rowPath, true)} title="Download">
          ⬇
        </a>
      )}
    </li>
  );
}

function GalleryTile({ view, row, onDescend, onStar }: { view: string; row: Row; onDescend: (p: string) => void; onStar: () => void }) {
  const rowPath = String(row.path);
  const name = String(row.name);
  const isDir = row.kind === 'dir';
  const ext = String(row.ext ?? '');
  const isImage = IMAGE_EXTS.has(ext);
  const starred = row._ann?.star === 'true';

  return (
    <div className="gtile">
      <button className={`gtile-star ${starred ? 'starred' : ''}`} title="Star" onClick={onStar}>
        {starred ? '★' : '☆'}
      </button>
      {isDir ? (
        <button className="gtile-thumb gtile-folder" onClick={() => onDescend(rowPath)}>
          📁
        </button>
      ) : isImage ? (
        <a className="gtile-thumb" href={fileUrl(view, rowPath)} target="_blank" rel="noreferrer noopener">
          <img src={fileUrl(view, rowPath)} alt={name} loading="lazy" />
        </a>
      ) : (
        <a className="gtile-thumb gtile-file" href={fileUrl(view, rowPath)} target="_blank" rel="noreferrer noopener">
          📄
        </a>
      )}
      <div className="gtile-name" title={name}>
        {name}
      </div>
    </div>
  );
}
