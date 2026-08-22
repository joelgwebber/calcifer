/** Client-side mirror of the host view manifest + data-plane shapes (calcifer-1d51.4). */

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

export type ActionSpec = string | { type: string; href?: string; label?: string; prompt?: string };

export interface CardSpec {
  title: string;
  subtitle?: string;
  thumbnail?: string;
  trailing?: string;
  badges?: Array<{ label: string; when?: string }>;
  actions?: ActionSpec[];
}

export interface DetailSpec {
  gallery?: string;
  fields?: string[];
  /** Field holding markdown/prose to render with the document primitive. */
  document?: string;
  timeline?: { source: string; foreignKey: string; date: string; label: string };
  actions?: ActionSpec[];
}

export interface CollectionSpec {
  label: string;
  filter?: Record<string, unknown>;
  annotation?: Record<string, boolean>;
  sort?: string;
}

export interface ViewManifest {
  view: string;
  title: string;
  icon?: string;
  presentation?: 'list' | 'tree' | 'gallery';
  group?: string;
  skill: string;
  idField: string;
  data: { type: string; path?: string; table?: string; root?: string; exts?: string[] };
  fields: Record<string, FieldSpec>;
  baseFilter?: Record<string, unknown>;
  collections?: Record<string, CollectionSpec>;
  defaultSort?: string;
  list: { card: CardSpec };
  detail?: DetailSpec;
  annotations?: string[];
}

export interface ViewSummary {
  view: string;
  title: string;
  icon?: string;
  group?: string;
}

export type Row = Record<string, unknown> & {
  _ann?: Record<string, string>;
  _timeline?: Array<Record<string, unknown>>;
  /** Parsed YAML frontmatter of the record's document, if any (server-parsed). */
  _frontmatter?: unknown;
};

export interface QueryResult {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  facets?: Record<string, Array<string | number>>;
}

/** UI-side filter state, serialized into the `filters` query param. */
export type FilterState = Record<string, unknown>;
