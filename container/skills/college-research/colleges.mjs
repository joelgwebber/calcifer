#!/usr/bin/env node
// college-research — thin query/validate/derive tool over the wiki college corpus.
//
// Corpus = plain OKF markdown, one `type: college` concept per file under schools/.
// LEAN shape: comparable numbers are BARE scalars in frontmatter, grouped by criterion
// (`engagement: { grad_rate_6yr: 91, ... }`); everything else is greppable prose.
// This tool is an accelerant, not a gatekeeper — the data stays usable with grep/yq.
// It reads schema.yml for the field registry, §4 "never read alone" pairings, and
// derived-field formulas.
//
// Tolerant of the OLD heavy shape too (a field value of `{ value: X, ... }` is read as
// X, and a `fields:` wrapper is honored), so records migrate to lean incrementally
// without breaking the tool.
//
// Usage:
//   colleges.mjs list
//   colleges.mjs missing <slug|all> [--criterion <name>]
//   colleges.mjs compare <field> [<field> ...]      # auto-adds §4 required pairings
//   colleges.mjs derive  [<slug|all>]               # recompute derived fields from inputs
//   colleges.mjs validate [<slug|all>]              # unknown-field, pairing, derive checks
//
// Env:
//   COLLEGES_DIR  corpus root (default /workspace/extra/shared/family-wiki/colleges)
//   COLLEGES_LIB  where js-yaml is installed (default /workspace/agent/college-research/node_modules)

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.env.COLLEGES_DIR || '/workspace/extra/shared/family-wiki/colleges';
const LIB = process.env.COLLEGES_LIB || '/workspace/agent/college-research/node_modules';

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

// Parse with the JSON schema so bare dates stay strings (not JS Date objects).
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
  orgs_per_1000_undergrads: (v) => ratio(v.undergrad_orgs_active, v.undergraduates, 1000),
};
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
const ratio = (a, b, k) =>
  num(a) !== undefined && num(b) && b !== 0 ? Math.round((a / b) * k * 100) / 100 : undefined;

// Unwrap a field value: bare scalar as-is, or the old `{ value: X, ... }` cell -> X.
function fieldVal(v) {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v) return v.value;
  return v;
}

function loadSchema(yaml) {
  const p = join(DIR, 'schema.yml');
  if (!existsSync(p)) die(`no schema.yml in ${DIR} — run the skill's Setup step first`);
  return ymlLoad(yaml, readFileSync(p, 'utf8'));
}

// bare field name -> { criterion, def } across all criteria.
function fieldIndex(schema) {
  const idx = new Map();
  for (const [crit, spec] of Object.entries(schema.criteria || {})) {
    for (const [name, def] of Object.entries(spec.fields || {})) idx.set(name, { criterion: crit, def });
  }
  return idx;
}

function loadSchools(yaml) {
  const dir = join(DIR, 'schools');
  if (!existsSync(dir)) die(`no schools/ dir in ${DIR}`);
  const out = [];
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.md') || f.startsWith('_')) continue;
    const { fm } = parseFrontmatter(yaml, readFileSync(join(dir, f), 'utf8'));
    if (!fm) continue;
    out.push({ file: f, slug: fm.slug || f.replace(/\.md$/, ''), fm });
  }
  return out;
}

// Flat map of bare field name -> value, tolerant of lean (top-level criterion blocks)
// and legacy (`fields:` wrapper, value cells) shapes.
function flatValues(schema, school) {
  const v = {};
  const crits = new Set(Object.keys(schema.criteria || {}));
  const fm = school.fm || {};
  const eat = (block) => {
    if (block && typeof block === 'object' && !Array.isArray(block)) {
      for (const [k, val] of Object.entries(block)) v[k] = fieldVal(val);
    }
  };
  if (fm.fields && typeof fm.fields === 'object') for (const g of Object.values(fm.fields)) eat(g); // legacy
  for (const [k, val] of Object.entries(fm)) {
    if (k === 'fields') continue;
    if (crits.has(k)) eat(val); // lean criterion block
    else v[k] = fieldVal(val); // top-level (undergraduates, title, location, ...)
  }
  return v;
}

// ---- output helpers --------------------------------------------------------
function table(headers, rows) {
  const w = headers.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? '').length)));
  const line = (cells) => cells.map((c, i) => String(c ?? '').padEnd(w[i])).join('  ').trimEnd();
  return [line(headers), w.map((n) => '-'.repeat(n)).join('  '), ...rows.map(line)].join('\n');
}
const fmtVal = (x) => (x === undefined || x === null || x === '' ? '—' : String(x));

// ---- verbs -----------------------------------------------------------------
function cmdList(schema, schools) {
  const idx = fieldIndex(schema);
  const total = [...idx.values()].filter(({ def }) => def.type !== 'derived').length;
  const rows = schools.map((s) => {
    const v = flatValues(schema, s);
    const filled = [...idx.keys()].filter((n) => v[n] !== undefined && v[n] !== '' && idx.get(n).def.type !== 'derived').length;
    return [s.slug, v.title || s.fm.school || '', v.institution_type || '', v.last_reviewed || '—', `${filled}/${total}`];
  });
  if (!rows.length) return console.log(`No schools yet in ${join(DIR, 'schools')}.`);
  console.log(table(['slug', 'title', 'type', 'reviewed', 'fields'], rows));
}

function cmdMissing(schema, schools, target, criterion) {
  const list = target === 'all' ? schools : schools.filter((s) => s.slug === target);
  if (!list.length) return target === 'all' ? console.log('No schools yet.') : die(`no such school: ${target}`);
  for (const s of list) {
    const v = flatValues(schema, s);
    const gaps = [];
    for (const [crit, spec] of Object.entries(schema.criteria || {})) {
      if (criterion && crit !== criterion) continue;
      for (const [name, def] of Object.entries(spec.fields || {})) {
        if (def.type === 'derived') continue;
        if (v[name] === undefined || v[name] === '') gaps.push(`${crit}.${name}`);
      }
    }
    console.log(`\n# ${s.slug} — ${gaps.length} unfilled field(s)`);
    console.log(gaps.length ? gaps.map((g) => `  - ${g}`).join('\n') : '  (all schema fields have a value)');
  }
}

function cmdCompare(schema, schools, fields) {
  const idx = fieldIndex(schema);
  const cols = [];
  const added = [];
  for (const f of fields) {
    if (!idx.has(f)) die(`unknown field: ${f}`);
    if (!cols.includes(f)) cols.push(f);
    const pair = idx.get(f).def.pair_with;
    if (pair && !fields.includes(pair)) {
      if (!cols.includes(pair)) cols.push(pair);
      added.push(`${pair} (companion of ${f}, §4)`);
    }
  }
  const rows = schools.map((s) => {
    const v = flatValues(schema, s);
    return [s.slug, ...cols.map((c) => fmtVal(v[c]))];
  });
  if (!rows.length) return console.log('No schools to compare.');
  console.log(table(['slug', ...cols], rows));
  if (added.length) console.log(`\nAuto-added (never read alone): ${added.join('; ')}`);
}

function cmdDerive(schema, schools, target) {
  const list = target === 'all' ? schools : schools.filter((s) => s.slug === target);
  if (!list.length) return target === 'all' ? console.log('No schools yet.') : die(`no such school: ${target}`);
  const idx = fieldIndex(schema);
  const derived = [...idx.entries()].filter(([, { def }]) => def.type === 'derived').map(([n]) => n);
  for (const s of list) {
    const v = flatValues(schema, s);
    const rows = derived.map((name) => {
      const fn = DERIVATIONS[name];
      const computed = fn ? fn(v) : undefined;
      const stored = v[name];
      let flag = '';
      if (computed === undefined) flag = 'missing inputs';
      else if (stored !== undefined && Math.abs(stored - computed) > 0.01) flag = `stored=${stored} ≠`;
      return [name, computed === undefined ? '—' : String(computed), flag];
    });
    console.log(`\n# ${s.slug} — derived`);
    console.log(table(['field', 'computed', 'note'], rows));
  }
}

function cmdValidate(schema, schools, target) {
  const list = target === 'all' ? schools : schools.filter((s) => s.slug === target);
  if (!list.length) return target === 'all' ? console.log('No schools yet.') : die(`no such school: ${target}`);
  const idx = fieldIndex(schema);
  const crits = new Set(Object.keys(schema.criteria || {}));
  let problems = 0;
  for (const s of list) {
    const warns = [];
    const v = flatValues(schema, s);
    // Unknown fields inside a criterion block (typo / not registered in schema.yml).
    const blocks = [];
    const fm = s.fm || {};
    if (fm.fields && typeof fm.fields === 'object') for (const [c, g] of Object.entries(fm.fields)) blocks.push([c, g]);
    for (const [k, val] of Object.entries(fm)) if (crits.has(k)) blocks.push([k, val]);
    for (const [c, g] of blocks) {
      if (!g || typeof g !== 'object') continue;
      for (const name of Object.keys(g)) if (!idx.has(name)) warns.push(`${c}.${name}: not in schema (typo/unregistered?)`);
    }
    // §4 pairings.
    for (const [name, { def }] of idx) {
      if (def.pair_with && v[name] !== undefined && v[name] !== '' && (v[def.pair_with] === undefined || v[def.pair_with] === ''))
        warns.push(`${name} present without required companion ${def.pair_with} (§4)`);
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
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== `--criterion`);

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
        '  derive  [slug|all]         recompute derived fields from inputs\n' +
        '  validate [slug|all]        unknown-field + §4 pairing checks',
    );
}
