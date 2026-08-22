#!/usr/bin/env node
// college-research — thin query/validate/derive tool over the wiki college corpus.
//
// The corpus is plain markdown: one file per school under schools/, with a YAML
// frontmatter "structured header" (fields grouped by criterion) and a prose body.
// This tool is an ACCELERANT, not a gatekeeper: the data stays fully usable with
// grep / find / yq if this script ever goes away. It reads schema.yml as the single
// source of truth for the field registry, §4 "never read alone" pairings, and
// derived-field formulas.
//
// Usage:
//   colleges.mjs list
//   colleges.mjs missing <slug|all> [--criterion <name>]
//   colleges.mjs compare <field> [<field> ...]      # auto-adds §4 required pairings
//   colleges.mjs derive  [<slug|all>]               # recompute derived fields from inputs
//   colleges.mjs validate [<slug|all>]              # provenance + pairing + schema checks
//
// Env:
//   COLLEGES_DIR  corpus root (default /workspace/extra/shared/family-wiki/colleges)
//   COLLEGES_LIB  where js-yaml is installed (default /workspace/agent/college-research/node_modules)

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.env.COLLEGES_DIR || '/workspace/extra/shared/family-wiki/colleges';
const LIB = process.env.COLLEGES_LIB || '/workspace/agent/college-research/node_modules';

// ---- YAML (js-yaml, resolved from several likely spots) --------------------
async function loadYaml() {
  const tries = [
    'js-yaml',
    join(LIB, 'js-yaml', 'index.js'),
    join(LIB, 'js-yaml', 'dist', 'js-yaml.mjs'),
    join(LIB, 'js-yaml', 'lib', 'index.js'),
  ];
  for (const spec of tries) {
    try {
      const m = await import(spec);
      return m.default || m;
    } catch { /* keep trying */ }
  }
  die(
    'js-yaml not found. One-time setup:\n' +
      `  mkdir -p ${LIB.replace(/\/node_modules$/, '')}\n` +
      `  ( cd ${LIB.replace(/\/node_modules$/, '')} && npm install js-yaml )`,
  );
}

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

// ---- frontmatter -----------------------------------------------------------
// Parse with the JSON schema so bare dates (2026-01-01) stay strings instead of
// becoming JS Date objects (YAML 1.1 timestamps), which mangles display + compare.
function ymlLoad(yaml, s) {
  return yaml.load(s, yaml.JSON_SCHEMA ? { schema: yaml.JSON_SCHEMA } : undefined);
}
function parseFrontmatter(yaml, text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { fm: null, body: text };
  return { fm: ymlLoad(yaml, m[1]) || {}, body: m[2] };
}

// Derived-field formulas. `v` is a flat map of bare field name -> value for a school.
const DERIVATIONS = {
  grad_gap_4_to_6: (v) => sub(v.grad_rate_6yr, v.grad_rate_4yr),
  subsections_per_1000_sections: (v) => ratio(v.subsections_total, v.sections_total, 1000),
  orgs_per_1000_undergrads: (v) => ratio(v.undergrad_orgs_active, v.undergraduates, 1000),
  student_allocated_per_undergrad: (v) => ratio(v.student_allocated_dollars, v.undergraduates, 1),
  funding_demand_ratio: (v) => ratio(v.funding_requested_dollars, v.student_allocated_dollars, 1),
};
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
const sub = (a, b) => (num(a) !== undefined && num(b) !== undefined ? round(a - b) : undefined);
const ratio = (a, b, k) =>
  num(a) !== undefined && num(b) && b !== 0 ? round((a / b) * k) : undefined;
const round = (x) => Math.round(x * 100) / 100;

// ---- corpus loading --------------------------------------------------------
function loadSchema(yaml) {
  const p = join(DIR, 'schema.yml');
  if (!existsSync(p)) die(`no schema.yml in ${DIR} — run the skill's Setup step first`);
  return ymlLoad(yaml, readFileSync(p, 'utf8'));
}

// Build: bare field name -> { criterion, def } across all criteria.
function fieldIndex(schema) {
  const idx = new Map();
  for (const [crit, spec] of Object.entries(schema.criteria || {})) {
    for (const [name, def] of Object.entries(spec.fields || {})) {
      idx.set(name, { criterion: crit, def });
    }
  }
  return idx;
}

function loadSchools(yaml) {
  const dir = join(DIR, 'schools');
  if (!existsSync(dir)) die(`no schools/ dir in ${DIR}`);
  const out = [];
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.md') || f.startsWith('_')) continue; // _template.md etc. are skipped
    const { fm, body } = parseFrontmatter(yaml, readFileSync(join(dir, f), 'utf8'));
    if (!fm) continue;
    out.push({ file: f, slug: fm.slug || f.replace(/\.md$/, ''), fm, body });
  }
  return out;
}

// Flat map of bare field name -> value for a school (across every criterion).
function flatValues(school) {
  const v = {};
  for (const group of Object.values(school.fm.fields || {})) {
    for (const [name, cell] of Object.entries(group || {})) {
      if (cell && typeof cell === 'object' && 'value' in cell) v[name] = cell.value;
    }
  }
  return v;
}

function getCell(school, name) {
  for (const group of Object.values(school.fm.fields || {})) {
    if (group && name in group) return group[name];
  }
  return undefined;
}

// ---- output helpers --------------------------------------------------------
function table(headers, rows) {
  const cols = headers.length;
  const w = headers.map((h, i) =>
    Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? '').length)),
  );
  const line = (cells) => cells.map((c, i) => String(c ?? '').padEnd(w[i])).join('  ').trimEnd();
  const out = [line(headers), w.map((n) => '-'.repeat(n)).join('  ')];
  for (const r of rows) out.push(line(r));
  return out.join('\n');
}

// ---- verbs -----------------------------------------------------------------
function cmdList(schema, schools) {
  const idx = fieldIndex(schema);
  const total = [...idx.values()].filter(({ def }) => def.type !== 'derived').length;
  const rows = schools.map((s) => {
    const v = flatValues(s);
    const filled = [...idx.keys()].filter((n) => n in v && idx.get(n).def.type !== 'derived').length;
    return [
      s.slug,
      s.fm.school || '',
      s.fm.schema_version || '?',
      s.fm.last_reviewed || '—',
      `${filled}/${total}`,
    ];
  });
  if (!rows.length) return console.log(`No schools yet in ${join(DIR, 'schools')}.`);
  console.log(table(['slug', 'school', 'schema', 'reviewed', 'fields'], rows));
}

function cmdMissing(schema, schools, target, criterion) {
  const list = target === 'all' ? schools : schools.filter((s) => s.slug === target);
  if (!list.length) die(`no such school: ${target}`);
  for (const s of list) {
    const v = flatValues(s);
    const gaps = [];
    for (const [crit, spec] of Object.entries(schema.criteria || {})) {
      if (criterion && crit !== criterion) continue;
      for (const [name, def] of Object.entries(spec.fields || {})) {
        if (def.type === 'derived') continue;
        if (!(name in v)) gaps.push(`${crit}.${name}`);
      }
    }
    console.log(`\n# ${s.slug} — ${gaps.length} unfilled field(s)`);
    if (gaps.length) console.log(gaps.map((g) => `  - ${g}`).join('\n'));
    else console.log('  (all schema fields have a value)');
  }
}

function cmdCompare(schema, schools, fields) {
  const idx = fieldIndex(schema);
  // Expand with §4 required pairings; keep order, dedupe.
  const cols = [];
  const added = [];
  for (const f of fields) {
    if (!idx.has(f)) die(`unknown field: ${f}`);
    if (!cols.includes(f)) cols.push(f);
    const pair = idx.get(f).def.pair_with;
    if (pair && !fields.includes(pair)) {
      if (!cols.includes(pair)) cols.push(pair);
      added.push(`${pair} (required companion of ${f}, §4)`);
    }
  }
  const rows = schools.map((s) => {
    const v = flatValues(s);
    return [s.slug, ...cols.map((c) => fmtVal(v[c]))];
  });
  if (!rows.length) return console.log('No schools to compare.');
  console.log(table(['slug', ...cols], rows));
  if (added.length) console.log(`\nAuto-added (never read alone): ${added.join('; ')}`);
}
const fmtVal = (x) => (x === undefined || x === null || x === '' ? '—' : String(x));

function cmdDerive(schema, schools, target) {
  const list = target === 'all' ? schools : schools.filter((s) => s.slug === target);
  if (!list.length) die(`no such school: ${target}`);
  const idx = fieldIndex(schema);
  const derived = [...idx.entries()].filter(([, { def }]) => def.type === 'derived').map(([n]) => n);
  for (const s of list) {
    const v = flatValues(s);
    const rows = [];
    for (const name of derived) {
      const fn = DERIVATIONS[name];
      const computed = fn ? fn(v) : undefined;
      const stored = v[name];
      let flag = '';
      if (computed === undefined) flag = 'missing inputs';
      else if (stored !== undefined && Math.abs(stored - computed) > 0.01) flag = `stored=${stored} ≠`;
      rows.push([name, computed === undefined ? '—' : String(computed), flag]);
    }
    console.log(`\n# ${s.slug} — derived`);
    console.log(table(['field', 'computed', 'note'], rows));
  }
}

function cmdValidate(schema, schools, target) {
  const list = target === 'all' ? schools : schools.filter((s) => s.slug === target);
  if (!list.length) die(`no such school: ${target}`);
  const idx = fieldIndex(schema);
  const meta = (schema.meta && schema.meta.enums) || {};
  const curVer = String(schema.schema_version ?? '');
  let problems = 0;
  for (const s of list) {
    const warns = [];
    if (String(s.fm.schema_version ?? '') !== curVer)
      warns.push(`schema_version ${s.fm.schema_version} ≠ current ${curVer}`);
    const v = flatValues(s);
    // Per-field metadata + enum + estimated-needs-notes.
    for (const [crit, group] of Object.entries(s.fm.fields || {})) {
      for (const [name, cell] of Object.entries(group || {})) {
        const known = idx.get(name);
        if (!known) { warns.push(`${crit}.${name}: not in schema (typo/unregistered?)`); continue; }
        if (known.def.type === 'derived') continue;
        if (!cell || typeof cell !== 'object') { warns.push(`${crit}.${name}: not a field object`); continue; }
        for (const k of schema.meta?.field_metadata || []) {
          if (k === 'notes') continue;
          if (cell[k] === undefined || cell[k] === '') warns.push(`${crit}.${name}: missing ${k}`);
        }
        if (meta.source_type && cell.source_type && !meta.source_type.includes(cell.source_type))
          warns.push(`${crit}.${name}: source_type "${cell.source_type}" not in enum`);
        if (meta.confidence && cell.confidence && !meta.confidence.includes(cell.confidence))
          warns.push(`${crit}.${name}: confidence "${cell.confidence}" not in enum`);
        if (cell.confidence === 'estimated' && !cell.notes)
          warns.push(`${crit}.${name}: estimated value requires notes (assumptions)`);
      }
    }
    // §4 pairing enforcement.
    for (const [name, { def }] of idx) {
      if (def.pair_with && name in v && !(def.pair_with in v))
        warns.push(`${name} present without required companion ${def.pair_with} (§4)`);
    }
    // References sanity.
    for (const [i, r] of (s.fm.references || []).entries()) {
      if (!r || !r.url) warns.push(`references[${i}]: missing url`);
      if (r && r.tier !== undefined && meta.tier && !meta.tier.includes(r.tier))
        warns.push(`references[${i}]: tier ${r.tier} not in ${JSON.stringify(meta.tier)}`);
    }
    problems += warns.length;
    console.log(`\n# ${s.slug} — ${warns.length ? warns.length + ' issue(s)' : 'OK'}`);
    if (warns.length) console.log(warns.map((w) => `  ! ${w}`).join('\n'));
  }
  if (problems) process.exitCode = 2;
}

// ---- main ------------------------------------------------------------------
const yaml = await loadYaml();
const [cmd, ...args] = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1]?.startsWith('--') !== true);

const schema = loadSchema(yaml);
const schools = loadSchools(yaml);

switch (cmd) {
  case 'list':
    cmdList(schema, schools);
    break;
  case 'missing':
    cmdMissing(schema, schools, positional[0] || 'all', opt('criterion'));
    break;
  case 'compare':
    if (!positional.length) die('compare needs at least one field name');
    cmdCompare(schema, schools, positional);
    break;
  case 'derive':
    cmdDerive(schema, schools, positional[0] || 'all');
    break;
  case 'validate':
    cmdValidate(schema, schools, positional[0] || 'all');
    break;
  default:
    console.log(
      'usage: colleges.mjs <list|missing|compare|derive|validate> [...]\n' +
        '  list                       overview of all schools + fill counts\n' +
        '  missing <slug|all>         unfilled schema fields (drives the workflow)\n' +
        '  compare <field> [field...] table across schools (+ §4 required pairings)\n' +
        '  derive  [slug|all]         recompute derived fields from stored inputs\n' +
        '  validate [slug|all]        provenance, pairing, and schema checks',
    );
}
