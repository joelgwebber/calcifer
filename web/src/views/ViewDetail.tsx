/** Record detail: field table + timeline + actions (calcifer-1d51.4). */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchManifest, fetchRecord, fileUrl, setAnnotation } from './api';
import { AskButton } from './AskButton';
import { FieldValue, detailFieldList, interpolate } from './primitives';
import { Prose } from './Prose';
import type { ActionSpec, Row, ViewManifest } from './types';

export function ViewDetail() {
  const { view = '', id = '' } = useParams();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<ViewManifest | null>(null);
  const [row, setRow] = useState<Row | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchManifest(view), fetchRecord(view, id)]).then(([m, r]) => {
      if (cancelled) return;
      setManifest(m);
      if (!r) setNotFound(true);
      else setRow(r);
    });
    return () => {
      cancelled = true;
    };
  }, [view, id]);

  if (!manifest) return <div className="view-loading">Loading…</div>;
  if (notFound)
    return (
      <div className="view-error">
        Record not found. <Link to={`/app/${view}`}>Back</Link>
      </div>
    );
  if (!row) return <div className="view-loading">Loading…</div>;

  const starred = row._ann?.star === 'true';
  const hasStar = manifest.annotations?.includes('star');
  const hasNote = manifest.annotations?.includes('note');
  const titleField = manifest.list.card.title;
  const docField = manifest.detail?.document;
  const rawDoc = docField ? String(row[docField] ?? '') : '';
  const hasDoc = !!rawDoc.trim();
  const { body: docBody } = splitFrontmatter(rawDoc);
  const docMarkdown = convertWikiLinks(docBody);

  // Intra-view navigation for the prose primitive: a relative .md link loads that
  // doc within the same view; anything else falls through to the browser.
  function onNavigate(href: string): boolean {
    if (href.startsWith('#')) return false;
    const target = resolveDocPath(id, href);
    if (!target || !/\.md$/i.test(target)) return false;
    navigate(`/app/${view}/${encodeURIComponent(target)}`);
    return true;
  }

  // Map a relative asset ref (image, or a link to a sibling pdf/doc) to the view's
  // byte endpoint. The source owns the bytes; the primitive stays source-agnostic.
  function resolveAsset(ref: string): string | null {
    if (!ref || ref.startsWith('#') || /^[a-z]+:/i.test(ref) || ref.startsWith('//')) return null;
    const target = resolveDocPath(id, ref);
    if (!target) return null;
    return `/api/views/${encodeURIComponent(view)}/file/${encodeURIComponent(target)}`;
  }

  async function toggleStar() {
    if (!row) return;
    const next = !starred;
    setRow({ ...row, _ann: { ...row._ann, star: next ? 'true' : '' } });
    await setAnnotation(view, id, 'star', next ? 'true' : null);
  }

  return (
    <div className="detail">
      <div className="detail-top">
        <Link className="detail-back" to={`/app/${manifest.view}`}>
          ← {manifest.title}
        </Link>
        <div className="detail-actions">
          {hasStar && (
            <button className={`icon-button ${starred ? 'starred' : ''}`} onClick={toggleStar}>
              {starred ? '★ Starred' : '☆ Star'}
            </button>
          )}
          {(manifest.detail?.actions ?? []).map((a, i) => (
            <DetailAction key={i} action={a} row={row} />
          ))}
          {manifest.data.type === 'fs' && !hasDoc && row.kind !== 'dir' && (
            <>
              <a className="icon-button" href={fileUrl(view, id)} target="_blank" rel="noreferrer noopener">
                Open ↗
              </a>
              <a className="icon-button" href={fileUrl(view, id, true)}>
                Download
              </a>
            </>
          )}
        </div>
      </div>

      <h1 className="detail-title">{interpolate(titleField, row)}</h1>

      {hasNote && <NoteEditor view={view} id={id} initial={row._ann?.note ?? ''} />}

      {hasDoc && (
        <div className="doc">
          {row._frontmatter ? <FrontmatterPanel data={row._frontmatter} /> : null}
          <Prose markdown={docMarkdown} nav={{ onNavigate, resolveAsset }} />
        </div>
      )}

      <table className="detail-fields">
        <tbody>
          {detailFieldList(manifest).map((name) => {
            const spec = manifest.fields[name];
            if (!spec || spec.type === 'document') return null;
            return (
              <tr key={name}>
                <th>{spec.label ?? name}</th>
                <td>
                  <FieldValue type={spec.type} value={row[name]} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {manifest.detail?.timeline && Array.isArray(row._timeline) && row._timeline.length > 0 && (
        <div className="detail-timeline">
          <h2>History</h2>
          <ul>
            {row._timeline.map((t, i) => (
              <li key={i}>
                <span className="tl-date">{formatDate(t[manifest.detail!.timeline!.date])}</span>
                <span className="tl-label">{interpolate(manifest.detail!.timeline!.label, t as Row)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NoteEditor({ view, id, initial }: { view: string; id: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');

  async function save() {
    setSaved('saving');
    await setAnnotation(view, id, 'note', text.trim() ? text.trim() : null);
    setSaved('saved');
    setTimeout(() => setSaved('idle'), 1500);
  }

  return (
    <div className="note-editor">
      <div className="note-label">Notes</div>
      <textarea
        className="note-input"
        value={text}
        placeholder="Add a shared note…"
        rows={2}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
      />
      <div className="note-status">{saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved' : ''}</div>
    </div>
  );
}

/** Split a leading YAML frontmatter block from the body (either may be empty). */
function splitFrontmatter(md: string): { frontmatter: string | null; body: string } {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
  if (!m) return { frontmatter: null, body: md };
  return { frontmatter: m[1], body: md.slice(m[0].length) };
}

/**
 * Convert `[[wikilinks]]` into standard relative markdown links so the existing
 * link handling (onNavigate) resolves them within the wiki. Supports
 * `[[target]]` and `[[target|label]]`; appends `.md` when target has no
 * extension. Targets resolve relative to the current document (see resolveDocPath).
 */
function convertWikiLinks(md: string): string {
  return md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target: string, label?: string) => {
    const t = target.trim();
    if (!t) return '';
    const l = (label ?? t).trim();
    const href = /\.[a-z0-9]+$/i.test(t) ? t : `${t}.md`;
    return `[${l}](${href})`;
  });
}

function isScalar(v: unknown): v is string | number | boolean {
  return v === null || v === undefined || ['string', 'number', 'boolean'].includes(typeof v);
}

/**
 * A "value cell" is the one shape that recurs across structured records (a college
 * field, and likely future OKF concepts): an object with a scalar `value`. We
 * special-case ONLY three keys — `value` (promoted to the headline), `source_url`
 * (turned into a link), and `notes` (tucked behind a disclosure). Every OTHER key
 * — `as_of`, `confidence`, `retrieved`, `source_type`, and anything we've never
 * seen — degrades to a compact `key: value` chip. Nothing is dropped or ranked;
 * that deliberate limit is the boundary where a per-type render schema would take
 * over (e.g. to format 57 -> "57%", order fields, or hide `retrieved`).
 */
function isValueCell(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v) && 'value' in v && isScalar((v as Record<string, unknown>).value);
}
const CELL_PROMOTED = new Set(['value', 'notes', 'source_url']);

/** Count rows a value renders as (for the collapse heuristic): a value cell is one row. */
function countLeaves(v: unknown): number {
  if (isValueCell(v)) return 1;
  if (Array.isArray(v)) return v.reduce<number>((n, x) => n + countLeaves(x), 0);
  if (v && typeof v === 'object') return Object.values(v).reduce<number>((n, x) => n + countLeaves(x), 0);
  return 1;
}

function ValueCell({ cell }: { cell: Record<string, unknown> }) {
  const src = typeof cell.source_url === 'string' && cell.source_url ? cell.source_url : undefined;
  const val = cell.value;
  const shown = val === '' || val === null || val === undefined ? '—' : String(val);
  const chips = Object.entries(cell).filter(
    ([k, v]) => !CELL_PROMOTED.has(k) && isScalar(v) && v !== '' && v !== null && v !== undefined,
  );
  const notes = typeof cell.notes === 'string' && cell.notes.trim() ? cell.notes.trim() : '';
  return (
    <div className="fm-cell">
      {src ? (
        <a className="fm-cell-value" href={src} target="_blank" rel="noreferrer noopener">
          {shown} ↗
        </a>
      ) : (
        <span className="fm-cell-value">{shown}</span>
      )}
      {chips.length > 0 && (
        <span className="fm-cell-byline">
          {chips.map(([k, v]) => (
            <span className="fm-chip" key={k}>
              <span className="fm-chip-k">{k}</span> {String(v)}
            </span>
          ))}
        </span>
      )}
      {notes && (
        <details className="fm-cell-notes">
          <summary>notes</summary>
          <div className="fm-cell-notes-body">{notes}</div>
        </details>
      )}
    </div>
  );
}

/** Recursively render a parsed-frontmatter value as a labeled, indented tree. */
function FmNode({ data }: { data: unknown }) {
  if (data === null || data === undefined || data === '') return <span className="fm-scalar fm-empty">—</span>;
  if (Array.isArray(data)) {
    return (
      <ul className="fm-list">
        {data.map((item, i) => (
          <li key={i}>
            <FmNode data={item} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof data === 'object') {
    return (
      <dl className="fm-tree">
        {Object.entries(data as Record<string, unknown>).map(([k, v]) => {
          if (isValueCell(v)) {
            return (
              <div className="fm-entry fm-leaf" key={k}>
                <dt className="fm-key">{k}</dt>
                <dd className="fm-val">
                  <ValueCell cell={v as Record<string, unknown>} />
                </dd>
              </div>
            );
          }
          const nested = !!v && typeof v === 'object';
          return (
            <div className={`fm-entry ${nested ? 'fm-nested' : 'fm-leaf'}`} key={k}>
              <dt className="fm-key">{k}</dt>
              <dd className="fm-val">
                <FmNode data={v} />
              </dd>
            </div>
          );
        })}
      </dl>
    );
  }
  return <span className="fm-scalar">{String(data)}</span>;
}

/**
 * Structured-frontmatter panel: prose leads, so heavy frontmatter (e.g. a college
 * record's fielded header) collapses by default; light frontmatter stays open.
 */
function FrontmatterPanel({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object') return null;
  const leaves = countLeaves(data);
  const heavy = leaves > 8;
  return (
    <details className="doc-frontmatter" open={!heavy}>
      <summary className="fm-summary">Structured fields{heavy ? ` · ${leaves}` : ''}</summary>
      <div className="fm-body">
        <FmNode data={data} />
      </div>
    </details>
  );
}

/** Resolve a relative markdown href against the current document's path. */
function resolveDocPath(currentPath: string, href: string): string {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) return '';
  const baseDir = currentPath.includes('/') ? currentPath.slice(0, currentPath.lastIndexOf('/')) : '';
  const start = clean.startsWith('/') ? [] : baseDir ? baseDir.split('/') : [];
  const stack = [...start];
  for (const part of clean.replace(/^\//, '').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function formatDate(v: unknown): string {
  if (!v) return '';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function DetailAction({ action, row }: { action: ActionSpec; row: Row }) {
  if (typeof action === 'string') return null;
  if (action.type === 'open' && action.href) {
    const href = interpolate(action.href, row);
    if (!href) return null;
    return (
      <a className="icon-button" href={href} target="_blank" rel="noreferrer">
        {action.label ?? 'Open'} ↗
      </a>
    );
  }
  if (action.type === 'ask') {
    return <AskButton label={action.label} prompt={action.prompt} row={row} />;
  }
  return null;
}
