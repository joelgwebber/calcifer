# College research corpus

A curated, evidence-disciplined college research system for Anaïs's college search.
One markdown file per school under `schools/`, with a structured header (comparable
fields) in YAML frontmatter and irreducible prose findings in the body.

This is deliberately **not** a database app. The set of schools is small, the schema
is still evolving, and half the value lives in prose that no schema can hold. Plain
files stay greppable, human-editable, diffable, and Seafile-synced — and the
`colleges.mjs` tool (shipped with the `college-research` skill) gives the structured
subset real queries on top.

## Layout

| Path | What |
|------|------|
| `README.md` | This file |
| `schema.yml` | Machine-readable field registry — the tool's source of truth; §4 pairings + derived formulas live here |
| `criteria/` | One spec per criterion (evidence model, falsification tests, field definitions). `engagement.md` is the first. |
| `schools/` | One record per school. `_template.md` is the blank; files starting with `_` are ignored by the tool. |

## How it works, briefly

- Each criterion (student engagement now; majors, class sizes, research, cost… later)
  decomposes the question into fields + prose, and carries its own falsification tests.
- Every field carries its source, the reporting period (`as_of`), and a confidence.
  Estimates must record their assumptions in `notes`.
- Some fields **must not be read alone** (e.g. `sections_under_20_pct` without
  `sections_50plus_pct`); the schema encodes those pairings and the tool enforces them.

## Querying (from the skill's tool)

```bash
node /app/skills/college-research/colleges.mjs list
node /app/skills/college-research/colleges.mjs missing northeastern
node /app/skills/college-research/colleges.mjs compare sections_under_20_pct
node /app/skills/college-research/colleges.mjs derive all
node /app/skills/college-research/colleges.mjs validate all
```

Everything here is also plain text: `grep -r civic schools/`, `yq '.fields.engagement' schools/northeastern.md`, etc.
