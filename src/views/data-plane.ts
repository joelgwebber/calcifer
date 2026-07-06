/**
 * Views data-plane read engine (calcifer-1d51.3).
 *
 * Reads a skill's workspace SQLite (the agent-owned fact store) READ-ONLY and
 * serves it as paginated, filtered, sorted rows with shared annotations merged
 * in. The host never writes the skill DB — single-writer stays with the agent.
 *
 * Query construction is fully parameterized and column names are whitelisted
 * against the live table schema (PRAGMA table_info), so a manifest or client
 * can never inject SQL. Client-supplied filters/sorts are further restricted to
 * fields the manifest explicitly marks filterable/sortable.
 */
import fs from 'fs';
import path from 'path';

import Database from 'better-sqlite3';

import { getAnnotationsFor, getEntityIdsWithAnnotation } from '../db/annotations.js';
import { GROUPS_DIR } from '../config.js';
import { log } from '../log.js';
import type { FilterValue, ViewManifest } from './manifest.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export interface QueryParams {
  collection?: string;
  filters?: Record<string, unknown>;
  q?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface QueryResult {
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
  /** Distinct values for each multiselect field, so the UI can offer options. */
  facets?: Record<string, Array<string | number>>;
}

export class ViewDataError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function dbPath(manifest: ViewManifest, agentGroupFolder: string): string {
  if (manifest.data.type !== 'sqlite' || !manifest.data.path) {
    throw new ViewDataError(501, `view "${manifest.view}" data.type not supported: ${manifest.data.type}`);
  }
  return path.join(GROUPS_DIR, agentGroupFolder, manifest.data.path);
}

function openReadonly(p: string): Database.Database | null {
  if (!fs.existsSync(p)) return null;
  const db = new Database(p, { readonly: true });
  db.pragma('busy_timeout = 5000');
  return db;
}

function tableColumns(db: Database.Database, table: string): Set<string> {
  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) throw new ViewDataError(500, `unsafe table name: ${table}`);
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

/** Resolve relative temporal tokens ("now-24h", "now-7d") to an ISO-UTC string. */
function resolveToken(v: string | number): string | number {
  if (typeof v !== 'string') return v;
  const m = /^now-(\d+)([hd])$/.exec(v);
  if (!m) return v;
  const n = parseInt(m[1], 10);
  const ms = m[2] === 'h' ? n * 3600_000 : n * 86_400_000;
  return new Date(Date.now() - ms).toISOString();
}

interface Where {
  clauses: string[];
  params: unknown[];
}

/** Apply a manifest-authored FilterValue (scalar / array / operator object). */
function applyManifestFilter(col: string, value: FilterValue, where: Where): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      where.clauses.push('0=1');
      return;
    }
    where.clauses.push(`${col} IN (${value.map(() => '?').join(',')})`);
    where.params.push(...value);
    return;
  }
  if (value && typeof value === 'object') {
    const op = value as {
      gte?: string | number;
      lte?: string | number;
      eq?: string | number;
      in?: Array<string | number>;
    };
    if (op.gte !== undefined) {
      where.clauses.push(`${col} >= ?`);
      where.params.push(resolveToken(op.gte));
    }
    if (op.lte !== undefined) {
      where.clauses.push(`${col} <= ?`);
      where.params.push(resolveToken(op.lte));
    }
    if (op.eq !== undefined) {
      where.clauses.push(`${col} = ?`);
      where.params.push(op.eq);
    }
    if (op.in !== undefined) {
      if (op.in.length === 0) where.clauses.push('0=1');
      else {
        where.clauses.push(`${col} IN (${op.in.map(() => '?').join(',')})`);
        where.params.push(...op.in);
      }
    }
    return;
  }
  // scalar
  where.clauses.push(`${col} = ?`);
  where.params.push(typeof value === 'boolean' ? (value ? 1 : 0) : resolveToken(value));
}

/** Apply a client-supplied filter, gated by the field's declared filter kind. */
function applyRequestFilter(
  manifest: ViewManifest,
  field: string,
  value: unknown,
  cols: Set<string>,
  where: Where,
): void {
  const spec = manifest.fields[field];
  if (!spec || !spec.filter || !cols.has(field)) return; // silently ignore unknown/non-filterable
  switch (spec.filter) {
    case 'range':
    case 'daterange': {
      const v = value as { min?: unknown; max?: unknown; from?: unknown; to?: unknown };
      const lo = v.min ?? v.from;
      const hi = v.max ?? v.to;
      if (lo !== undefined && lo !== null && lo !== '') {
        where.clauses.push(`${field} >= ?`);
        where.params.push(resolveToken(lo as string | number));
      }
      if (hi !== undefined && hi !== null && hi !== '') {
        where.clauses.push(`${field} <= ?`);
        where.params.push(resolveToken(hi as string | number));
      }
      break;
    }
    case 'multiselect': {
      const arr = Array.isArray(value) ? value : [value];
      const vals = arr.filter((x) => x !== undefined && x !== null && x !== '');
      if (vals.length > 0) {
        where.clauses.push(`${field} IN (${vals.map(() => '?').join(',')})`);
        where.params.push(...vals);
      }
      break;
    }
    case 'toggle': {
      if (value === true || value === 'true' || value === 1 || value === '1') {
        where.clauses.push(`${field} = 1`);
      }
      break;
    }
    case 'search': {
      if (typeof value === 'string' && value.trim()) {
        where.clauses.push(`${field} LIKE ?`);
        where.params.push(`%${value.trim()}%`);
      }
      break;
    }
  }
}

/** Free-text search across every field declared `search: true`. */
function applySearch(manifest: ViewManifest, q: string, cols: Set<string>, where: Where): void {
  const searchable = Object.entries(manifest.fields)
    .filter(([name, s]) => s.search && cols.has(name))
    .map(([name]) => name);
  if (searchable.length === 0 || !q.trim()) return;
  where.clauses.push('(' + searchable.map((c) => `${c} LIKE ?`).join(' OR ') + ')');
  for (let i = 0; i < searchable.length; i++) where.params.push(`%${q.trim()}%`);
}

function parseSort(sort: string): { col: string; dir: 'ASC' | 'DESC' } {
  if (sort.startsWith('-')) return { col: sort.slice(1), dir: 'DESC' };
  return { col: sort, dir: 'ASC' };
}

export function queryView(manifest: ViewManifest, agentGroupFolder: string, params: QueryParams): QueryResult {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const empty: QueryResult = { items: [], total: 0, page, pageSize };

  const db = openReadonly(dbPath(manifest, agentGroupFolder));
  if (!db) return empty;

  try {
    const table = manifest.data.table;
    if (!table) throw new ViewDataError(500, `view "${manifest.view}" missing data.table`);
    const cols = tableColumns(db, table);
    const where: Where = { clauses: [], params: [] };

    // 1. base filter (always applied)
    for (const [field, value] of Object.entries(manifest.baseFilter ?? {})) {
      if (cols.has(field)) applyManifestFilter(field, value, where);
    }

    // 2. collection preset (filter + annotation restriction)
    const collection = params.collection ? manifest.collections?.[params.collection] : undefined;
    if (params.collection && !collection) throw new ViewDataError(400, `unknown collection: ${params.collection}`);
    if (collection) {
      for (const [field, value] of Object.entries(collection.filter ?? {})) {
        if (cols.has(field)) applyManifestFilter(field, value, where);
      }
      for (const key of Object.keys(collection.annotation ?? {})) {
        const ids = getEntityIdsWithAnnotation(manifest.skill, key);
        if (ids.length === 0) {
          where.clauses.push('0=1');
        } else {
          where.clauses.push(`${manifest.idField} IN (${ids.map(() => '?').join(',')})`);
          where.params.push(...ids);
        }
      }
    }

    // 3. client filters + search
    for (const [field, value] of Object.entries(params.filters ?? {})) {
      applyRequestFilter(manifest, field, value, cols, where);
    }
    if (params.q) applySearch(manifest, params.q, cols, where);

    const whereSql = where.clauses.length ? `WHERE ${where.clauses.join(' AND ')}` : '';

    const total = (db.prepare(`SELECT COUNT(*) AS n FROM ${table} ${whereSql}`).get(...where.params) as { n: number })
      .n;

    // 4. sort (client > collection > manifest default), whitelisted
    const sortSpec = params.sort ?? collection?.sort ?? manifest.defaultSort;
    let orderSql = '';
    if (sortSpec) {
      const { col, dir } = parseSort(sortSpec);
      const clientSort = params.sort !== undefined;
      const allowed = cols.has(col) && (!clientSort || manifest.fields[col]?.sort === true);
      if (allowed) orderSql = `ORDER BY ${col} ${dir}`;
    }

    const rows = db
      .prepare(`SELECT * FROM ${table} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`)
      .all(...where.params, pageSize, (page - 1) * pageSize) as Array<Record<string, unknown>>;

    // 5. merge shared annotations
    const ids = rows.map((r) => String(r[manifest.idField]));
    const ann = getAnnotationsFor(manifest.skill, ids);
    for (const r of rows) r._ann = ann.get(String(r[manifest.idField])) ?? {};

    // 6. facets: distinct values for multiselect fields (options for the UI)
    const facets: Record<string, Array<string | number>> = {};
    for (const [name, spec] of Object.entries(manifest.fields)) {
      if (spec.filter === 'multiselect' && cols.has(name)) {
        const vals = db
          .prepare(
            `SELECT DISTINCT ${name} AS v FROM ${table} WHERE ${name} IS NOT NULL AND ${name} != '' ORDER BY ${name} LIMIT 200`,
          )
          .all() as Array<{ v: string | number }>;
        facets[name] = vals.map((r) => r.v);
      }
    }

    return { items: rows, total, page, pageSize, facets };
  } finally {
    db.close();
  }
}

export function getViewRecord(
  manifest: ViewManifest,
  agentGroupFolder: string,
  id: string,
): Record<string, unknown> | null {
  const db = openReadonly(dbPath(manifest, agentGroupFolder));
  if (!db) return null;
  try {
    const table = manifest.data.table;
    if (!table) throw new ViewDataError(500, `view "${manifest.view}" missing data.table`);
    const cols = tableColumns(db, table);
    if (!cols.has(manifest.idField)) throw new ViewDataError(500, `idField not a column: ${manifest.idField}`);
    const row = db.prepare(`SELECT * FROM ${table} WHERE ${manifest.idField} = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;

    row._ann = getAnnotationsFor(manifest.skill, [id]).get(id) ?? {};

    // Related-rows timeline (e.g. price sightings).
    const tl = manifest.detail?.timeline;
    if (tl) {
      try {
        const tlCols = tableColumns(db, tl.source);
        if (tlCols.has(tl.foreignKey) && tlCols.has(tl.date)) {
          row._timeline = db
            .prepare(`SELECT * FROM ${tl.source} WHERE ${tl.foreignKey} = ? ORDER BY ${tl.date} ASC`)
            .all(id) as Array<Record<string, unknown>>;
        }
      } catch (err) {
        log.warn('view timeline query failed', { view: manifest.view, err });
      }
    }
    return row;
  } finally {
    db.close();
  }
}
