/** Record detail: field table + timeline + actions (calcifer-1d51.4). */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchManifest, fetchRecord, setAnnotation } from './api';
import { AskButton } from './AskButton';
import { FieldValue, detailFieldList, interpolate } from './primitives';
import type { ActionSpec, Row, ViewManifest } from './types';

export function ViewDetail() {
  const { view = '', id = '' } = useParams();
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
        </div>
      </div>

      <h1 className="detail-title">{interpolate(titleField, row)}</h1>

      {hasNote && <NoteEditor view={view} id={id} initial={row._ann?.note ?? ''} />}

      <table className="detail-fields">
        <tbody>
          {detailFieldList(manifest).map((name) => {
            const spec = manifest.fields[name];
            if (!spec) return null;
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
