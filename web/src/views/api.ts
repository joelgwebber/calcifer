/** View data-plane client (calcifer-1d51.4). Same-origin, cookie-authed. */
import type { QueryResult, Row, ViewManifest, ViewSummary } from './types';

const opts: RequestInit = { credentials: 'same-origin' };

export async function fetchViewList(): Promise<ViewSummary[]> {
  const res = await fetch('/api/views', opts);
  if (!res.ok) return [];
  const data = (await res.json()) as { views: ViewSummary[] };
  return data.views ?? [];
}

export async function fetchManifest(view: string): Promise<ViewManifest> {
  const res = await fetch(`/api/views/${encodeURIComponent(view)}`, opts);
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  const data = (await res.json()) as { manifest: ViewManifest };
  return data.manifest;
}

export interface DataParams {
  collection?: string;
  filters?: Record<string, unknown>;
  q?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  /** fs tree presentation: list one folder level. */
  browse?: boolean;
  path?: string;
}

export async function fetchViewData(view: string, params: DataParams): Promise<QueryResult> {
  const sp = new URLSearchParams();
  if (params.collection) sp.set('collection', params.collection);
  if (params.filters && Object.keys(params.filters).length) sp.set('filters', JSON.stringify(params.filters));
  if (params.q) sp.set('q', params.q);
  if (params.sort) sp.set('sort', params.sort);
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  if (params.browse) sp.set('browse', '1');
  if (params.path) sp.set('path', params.path);
  const res = await fetch(`/api/views/${encodeURIComponent(view)}/data?${sp.toString()}`, opts);
  if (!res.ok) throw new Error(`data ${res.status}`);
  return (await res.json()) as QueryResult;
}

export async function fetchRecord(view: string, id: string): Promise<Row | null> {
  const res = await fetch(`/api/views/${encodeURIComponent(view)}/record/${encodeURIComponent(id)}`, opts);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`record ${res.status}`);
  const data = (await res.json()) as { record: Row };
  return data.record;
}

/** URL for the fs byte endpoint (inline, or download=true to force save). */
export function fileUrl(view: string, filePath: string, download = false): string {
  return `/api/views/${encodeURIComponent(view)}/file/${encodeURIComponent(filePath)}${download ? '?download=1' : ''}`;
}

/** Set (value != null) or clear (value == null) a shared annotation. */
export async function setAnnotation(view: string, entityId: string, key: string, value: string | null): Promise<void> {
  await fetch('/api/annotations', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ view, entity_id: entityId, key, value }),
  });
}
