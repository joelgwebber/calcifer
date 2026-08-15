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
  const { frontmatter, body: docBody } = splitFrontmatter(rawDoc);
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
          {frontmatter && <FrontmatterHeader raw={frontmatter} />}
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

/** Lightly parse `key: value` frontmatter lines; `[a, b]` values become lists. */
function parseFrontmatter(raw: string): Array<{ key: string; values: string[] }> {
  const out: Array<{ key: string; values: string[] }> = [];
  for (const line of raw.split('\n')) {
    const m = /^([A-Za-z0-9_ -]+):\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const key = m[1].trim();
    const rawVal = m[2].trim();
    let values: string[];
    if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      values = rawVal
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      const v = rawVal.replace(/^["']|["']$/g, '');
      values = v ? [v] : [];
    }
    out.push({ key, values });
  }
  return out;
}

/** Render frontmatter as a small metadata header above the document body. */
function FrontmatterHeader({ raw }: { raw: string }) {
  const entries = parseFrontmatter(raw).filter((e) => e.values.length > 0);
  if (entries.length === 0) return null;
  return (
    <dl className="doc-frontmatter">
      {entries.map((e) => (
        <div className="fm-row" key={e.key}>
          <dt className="fm-key">{e.key}</dt>
          <dd className="fm-vals">
            {e.values.map((v, i) => (
              <span className="v-badge" key={i}>
                {v}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
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
