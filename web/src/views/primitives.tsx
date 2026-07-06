/** Fixed render primitives + template interpolation (calcifer-1d51.4). */
import type { ReactNode } from 'react';
import type { FieldType, Row, ViewManifest } from './types';

/** Replace {field} tokens in a template with a row's values. */
export function interpolate(template: string, row: Row): string {
  return template.replace(/\{([a-z0-9_]+)\}/gi, (_, key: string) => {
    const v = row[key];
    return v === null || v === undefined ? '' : String(v);
  });
}

/** Evaluate a "{field}" truthiness token (for badge `when` / boolean gates). */
export function truthyToken(token: string | undefined, row: Row): boolean {
  if (!token) return true;
  const m = /^\{([a-z0-9_]+)\}$/i.exec(token);
  if (!m) return Boolean(token);
  const v = row[m[1]];
  return v !== null && v !== undefined && v !== 0 && v !== '0' && v !== false && v !== '';
}

function money(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '';
  return '$' + n.toLocaleString('en-US');
}

function datetime(v: unknown): string {
  if (!v) return '';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  const diffMs = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diffMs >= 0 && diffMs < day) {
    const h = Math.floor(diffMs / 3_600_000);
    if (h < 1) return 'just now';
    return `${h}h ago`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Render a single typed value as a node. */
export function FieldValue({ type, value }: { type: FieldType; value: unknown }): ReactNode {
  if (value === null || value === undefined || value === '') return <span className="v-empty">—</span>;
  switch (type) {
    case 'money':
      return <span>{money(value)}</span>;
    case 'datetime':
      return <span title={String(value)}>{datetime(value)}</span>;
    case 'bool':
      return <span>{value === 1 || value === true || value === '1' ? 'Yes' : 'No'}</span>;
    case 'badge':
      return <span className="v-badge">{String(value)}</span>;
    case 'image':
      return <img className="v-image" src={String(value)} alt="" />;
    case 'link':
      return (
        <a className="v-link" href={String(value)} target="_blank" rel="noreferrer">
          Open ↗
        </a>
      );
    case 'number':
    case 'text':
    case 'keyvalue':
    default:
      return <span>{String(value)}</span>;
  }
}

/** Fields safe to show as key/value in a detail table (skip internal _ keys). */
export function detailFieldList(manifest: ViewManifest): string[] {
  if (manifest.detail?.fields?.length) return manifest.detail.fields;
  return Object.keys(manifest.fields);
}
