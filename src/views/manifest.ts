/**
 * View manifest format + loader/registry (calcifer-1d51.2).
 *
 * A "view" is a skill-declared, host-rendered UI surface. The skill ships a
 * static `view.json` in its skill dir; the host loads it into a registry and
 * the web app renders it from a FIXED primitive vocabulary — no skill code runs
 * client-side. This keeps skill UIs safe, consistent, and cheap to declare.
 *
 * Field/data-source/action sets are intentionally OPEN string unions: today the
 * data plane implements `sqlite` sources and the list/card/detail primitives;
 * future tiers (http/agent sources, document/tree primitives, sandboxed render)
 * slot in without a manifest redesign (see parent yak calcifer-1d51).
 */
import fs from 'fs';
import path from 'path';

import { log } from '../log.js';

export type FieldType =
  | 'text'
  | 'money'
  | 'datetime'
  | 'number'
  | 'bool'
  | 'badge'
  | 'image'
  | 'link'
  | 'keyvalue'
  | 'document';

export type FilterKind = 'range' | 'multiselect' | 'toggle' | 'daterange' | 'search';

export interface FieldSpec {
  type: FieldType;
  label?: string;
  filter?: FilterKind;
  sort?: boolean;
  search?: boolean;
}

/** A value in a collection/base filter: a bare scalar or an operator object. */
export type FilterValue =
  | string
  | number
  | boolean
  | string[]
  | { gte?: string | number; lte?: string | number; eq?: string | number; in?: Array<string | number> };

export interface CollectionSpec {
  label: string;
  /** field -> FilterValue applied as the collection's base predicate. */
  filter?: Record<string, FilterValue>;
  /** annotation key -> true: restrict to entities carrying that annotation. */
  annotation?: Record<string, boolean>;
  /** "field" (asc) or "-field" (desc). */
  sort?: string;
}

export type ActionSpec =
  | string // shorthand: "star" | "note"
  | { type: string; href?: string; label?: string; prompt?: string };

export interface CardSpec {
  title: string;
  subtitle?: string;
  thumbnail?: string;
  /** A single field rendered typed + prominent on the trailing edge (e.g. price). */
  trailing?: string;
  badges?: Array<{ label: string; when?: string }>;
  actions?: ActionSpec[];
}

export interface DetailSpec {
  gallery?: string;
  fields?: string[];
  /** Field holding markdown/prose to render with the document primitive (e.g. a
   *  wiki page body). Source-agnostic: any record with a markdown field works. */
  document?: string;
  /** A related-rows timeline, e.g. price sightings. `foreignKey` joins the
   *  source table back to this view's idField value. */
  timeline?: { source: string; foreignKey: string; date: string; label: string };
  actions?: ActionSpec[];
}

export interface DataSource {
  type: 'sqlite' | 'fs' | 'http' | 'agent';
  /**
   * Where a sqlite `path` is resolved:
   *   'agent'  (default) — the viewing user's agent-group workspace (per-user data)
   *   'shared'          — the cross-agent shared data root (one family-wide DB)
   * Ignored by fs sources (they resolve under FS_VIEW_ROOT).
   */
  scope?: 'agent' | 'shared';
  /** For sqlite: path relative to the resolved root (agent workspace or shared root). */
  path?: string;
  table?: string;
  /** For fs: directory (relative to FS_VIEW_ROOT) whose files become records. */
  root?: string;
  /** For fs: restrict records to files with these extensions, e.g. ["md"]. Omit = all files. */
  exts?: string[];
}

export interface ViewManifest {
  /** URL/registry key, e.g. "apartments". */
  view: string;
  title: string;
  icon?: string;
  /**
   * List-level presentation (the primitive used to project records when browsing
   * the whole view). Decoupled from the data source, so different libraries can
   * render the same fs backend differently. 'list' = cards (default); 'tree' =
   * folder browser (single-level, navigable). Detail presentation is separate.
   */
  presentation?: 'list' | 'tree' | 'gallery';
  /** Rail grouping label, e.g. "Libraries". Ungrouped views sit at the top level. */
  group?: string;
  /** Annotation namespace, e.g. "nyc-apt". Defaults to `view`. */
  skill: string;
  /** Primary key column of the data source. Defaults to "id". */
  idField: string;
  data: DataSource;
  fields: Record<string, FieldSpec>;
  /** Predicate applied to EVERY query (e.g. status='active'). */
  baseFilter?: Record<string, FilterValue>;
  collections?: Record<string, CollectionSpec>;
  defaultSort?: string;
  list: { card: CardSpec };
  detail?: DetailSpec;
  /** Annotation keys this view exposes (e.g. ["star","note"]). */
  annotations?: string[];
}

function skillsDir(): string {
  return path.resolve(process.cwd(), 'container', 'skills');
}

function validate(raw: unknown, source: string): ViewManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.view !== 'string' || typeof m.title !== 'string') {
    log.warn('view manifest missing view/title', { source });
    return null;
  }
  if (!m.data || typeof m.data !== 'object' || typeof (m.data as DataSource).type !== 'string') {
    log.warn('view manifest missing data.type', { source, view: m.view });
    return null;
  }
  if (!m.fields || typeof m.fields !== 'object') {
    log.warn('view manifest missing fields', { source, view: m.view });
    return null;
  }
  const list = m.list as { card?: CardSpec } | undefined;
  if (!list?.card || typeof list.card.title !== 'string') {
    log.warn('view manifest missing list.card.title', { source, view: m.view });
    return null;
  }
  return {
    view: m.view as string,
    title: m.title as string,
    icon: typeof m.icon === 'string' ? m.icon : undefined,
    presentation:
      m.presentation === 'tree' || m.presentation === 'gallery' ? (m.presentation as 'tree' | 'gallery') : 'list',
    group: typeof m.group === 'string' ? m.group : undefined,
    skill: typeof m.skill === 'string' ? (m.skill as string) : (m.view as string),
    idField: typeof m.idField === 'string' ? (m.idField as string) : 'id',
    data: { scope: 'agent', ...(m.data as DataSource) },
    fields: m.fields as Record<string, FieldSpec>,
    baseFilter: (m.baseFilter as Record<string, FilterValue>) ?? undefined,
    collections: (m.collections as Record<string, CollectionSpec>) ?? undefined,
    defaultSort: typeof m.defaultSort === 'string' ? (m.defaultSort as string) : undefined,
    list: list as { card: CardSpec },
    detail: (m.detail as DetailSpec) ?? undefined,
    annotations: Array.isArray(m.annotations) ? (m.annotations as string[]) : undefined,
  };
}

let registry: Map<string, ViewManifest> | null = null;

/** Parse+validate one manifest file into the registry (last writer wins on view key). */
function loadOne(reg: Map<string, ViewManifest>, filePath: string): void {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    const manifest = validate(parsed, filePath);
    if (manifest) {
      reg.set(manifest.view, manifest);
      log.info('Loaded view manifest', { view: manifest.view, skill: manifest.skill });
    }
  } catch (err) {
    log.warn('Failed to parse view manifest', { path: filePath, err });
  }
}

/**
 * Build the registry from every skill dir. A skill may declare views two ways:
 *   <skill>/view.json         — a single view (legacy / one-off)
 *   <skill>/views/*.json       — many views (e.g. one per Seafile library)
 * so a single skill (like `seafile`) can expose a whole family of libraries.
 */
export function loadViewManifests(): Map<string, ViewManifest> {
  const reg = new Map<string, ViewManifest>();
  const dir = skillsDir();
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    // No skills dir (unusual) — empty registry.
    registry = reg;
    return reg;
  }
  for (const name of entries) {
    const single = path.join(dir, name, 'view.json');
    if (fs.existsSync(single)) loadOne(reg, single);

    const viewsDir = path.join(dir, name, 'views');
    let viewFiles: string[] = [];
    try {
      viewFiles = fs.readdirSync(viewsDir);
    } catch {
      viewFiles = [];
    }
    for (const f of viewFiles) {
      if (f.endsWith('.json')) loadOne(reg, path.join(viewsDir, f));
    }
  }
  registry = reg;
  return reg;
}

export function getViewRegistry(): Map<string, ViewManifest> {
  return registry ?? loadViewManifests();
}

export function getView(name: string): ViewManifest | undefined {
  return getViewRegistry().get(name);
}

export interface ViewSummary {
  view: string;
  title: string;
  icon?: string;
  group?: string;
}

export function listViewSummaries(): ViewSummary[] {
  return [...getViewRegistry().values()].map((m) => ({ view: m.view, title: m.title, icon: m.icon, group: m.group }));
}
