/** Declarative filter controls (calcifer-1d51.4). */
import type { FieldSpec, FilterState, QueryResult, ViewManifest } from './types';

export function Filters({
  manifest,
  facets,
  value,
  onChange,
}: {
  manifest: ViewManifest;
  facets: QueryResult['facets'];
  value: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const filterable = Object.entries(manifest.fields).filter(([, s]) => s.filter && s.filter !== 'search');
  if (filterable.length === 0) return null;

  function set(field: string, v: unknown) {
    const next = { ...value };
    if (v === undefined || v === null || (typeof v === 'object' && v !== null && Object.keys(v).length === 0)) {
      delete next[field];
    } else {
      next[field] = v;
    }
    onChange(next);
  }

  return (
    <div className="filters">
      {filterable.map(([name, spec]) => (
        <div className="filter" key={name}>
          <div className="filter-label">{spec.label ?? name}</div>
          <Control name={name} spec={spec} facets={facets?.[name]} value={value[name]} set={set} />
        </div>
      ))}
    </div>
  );
}

function Control({
  name,
  spec,
  facets,
  value,
  set,
}: {
  name: string;
  spec: FieldSpec;
  facets?: Array<string | number>;
  value: unknown;
  set: (field: string, v: unknown) => void;
}) {
  if (spec.filter === 'range' || spec.filter === 'daterange') {
    const isDate = spec.filter === 'daterange';
    const v = (value as { min?: string; max?: string; from?: string; to?: string }) ?? {};
    const lo = v.min ?? v.from ?? '';
    const hi = v.max ?? v.to ?? '';
    const key = isDate ? (['from', 'to'] as const) : (['min', 'max'] as const);
    const t = isDate ? 'date' : 'number';
    const upd = (which: 0 | 1, raw: string) => {
      const next: Record<string, string> = { ...(value as object) };
      if (raw === '') delete next[key[which]];
      else next[key[which]] = raw;
      set(name, next);
    };
    return (
      <div className="filter-range">
        <input type={t} value={lo} placeholder="min" onChange={(e) => upd(0, e.target.value)} />
        <span>–</span>
        <input type={t} value={hi} placeholder="max" onChange={(e) => upd(1, e.target.value)} />
      </div>
    );
  }

  if (spec.filter === 'toggle') {
    return (
      <label className="filter-toggle">
        <input type="checkbox" checked={value === true} onChange={(e) => set(name, e.target.checked ? true : undefined)} />
        <span>only</span>
      </label>
    );
  }

  if (spec.filter === 'multiselect') {
    const selected = new Set(Array.isArray(value) ? (value as Array<string | number>).map(String) : []);
    const options = facets ?? [];
    const toggle = (opt: string | number) => {
      const s = new Set(selected);
      const key = String(opt);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      set(name, s.size ? [...s] : undefined);
    };
    return (
      <div className="filter-multi">
        {options.length === 0 && <span className="v-empty">—</span>}
        {options.map((opt) => (
          <label key={String(opt)} className="filter-chip">
            <input type="checkbox" checked={selected.has(String(opt))} onChange={() => toggle(opt)} />
            <span>{String(opt)}</span>
          </label>
        ))}
      </div>
    );
  }

  return null;
}
