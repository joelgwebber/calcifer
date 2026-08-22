---
name: college-research
description: Collaborative, evidence-disciplined college research for a college search. Researches schools against decomposed criteria (student engagement now; majors, class sizes, research, cost as we add them), records findings as one wiki file per school with comparable structured fields plus required prose, and gives real queries over the structured subset. Use when the user wants to research, compare, or add a college.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, WebSearch, WebFetch, mcp__seafile__*
---

# College research

A curated research system for a college search. It does the heavy lifting of
gathering and structuring evidence about schools, under a discipline designed to
resist marketing spin, while keeping the irreducible qualitative findings as
first-class prose.

**This is wiki-native, not an app.** One markdown file per school: a structured
header (comparable fields) in YAML frontmatter, plus prose findings in the body.
The set of schools is small and the schema keeps evolving, so plain files —
greppable, human-editable, diffable, Seafile-synced — beat a database. A small
`colleges.mjs` tool adds real queries on top of the structured subset.

## Layout (code vs. data)

- **Code** (this skill, read-only): `/app/skills/college-research/` — `colleges.mjs`
  (the query/validate tool) and `starter/` (the scaffold copied into the wiki on
  first run).
- **Data** (the corpus, read-write, Seafile-synced): the family wiki at
  `/workspace/extra/shared/family-wiki/colleges/` — `schema.yml`, `criteria/`,
  `schools/`, `README.md`. This is the source of truth and it evolves; edit it freely.
- **Runtime lib** (writable, NOT synced): `js-yaml` for the tool, installed once
  under `/workspace/agent/college-research/node_modules` — kept out of the wiki so
  Seafile never syncs `node_modules`.

## Setup (one time)

```bash
CORPUS=/workspace/extra/shared/family-wiki/colleges
LIBDIR=/workspace/agent/college-research

# 1. Query lib (js-yaml), kept out of Seafile.
mkdir -p "$LIBDIR" && ( cd "$LIBDIR" && npm install js-yaml )

# 2. Scaffold the corpus in the wiki if absent (additive; never overwrites).
if [ ! -e "$CORPUS/schema.yml" ]; then
  mkdir -p "$CORPUS"
  cp -rn /app/skills/college-research/starter/. "$CORPUS/"
fi

# 3. Verify.
node /app/skills/college-research/colleges.mjs list
```

## The corpus

| Path (under the wiki `colleges/`) | What |
|------|------|
| `schema.yml` | Machine-readable field registry — the tool's source of truth. Field defs, §4 pairings, derived formulas. |
| `criteria/<name>.md` | One spec per criterion: its decomposition, falsification tests, field notes, open questions. `engagement.md` first. |
| `schools/<slug>.md` | One record per school. `_template.md` is the blank; files starting with `_` are skipped by the tool. |

## Record format

Frontmatter = the structured header; body = exposition + references. See
`schools/_template.md` for the exact shape. Rules:

- Fields are grouped by criterion: `fields.<criterion>.<field>`. Each cell carries the
  full metadata contract (`value, source_url, source_type, as_of, retrieved,
  confidence, notes` — see `schema.yml` `meta`).
- `as_of` is the **reporting period of the data**, not the retrieval date and not the
  CDS edition year (institutions publish CDS sections with inconsistent lag — a
  2024-25 CDS may report Fall 2023 class sizes). Getting this wrong silently offsets
  comparisons by a year.
- **Never fabricate a value.** If you cannot verify a field, leave it out — `colleges.mjs
  missing` will list it. A value with `confidence: estimated` **requires** a `notes`
  line stating the assumptions and arithmetic.
- Derived fields (e.g. `grad_gap_4_to_6`, `orgs_per_1000_undergrads`) are **not stored** —
  store their inputs and let `colleges.mjs derive` compute them.
- References go in a `## References` section in the **body** (not frontmatter), each an
  entry with an `id`, link, `tier` (1-3) and, for student media, `provenance`
  (`news` / `op-ed` / `letter`). Cite them inline by `id`. Keeping them in the body
  reads naturally and keeps the structured header light.

## Evidence model (universal discipline — applies to every criterion)

Rank sources by how expensive they are for an institution to fake:

- **Tier 1 — student-produced, timestamped, not institutionally curated** (highest value,
  lowest volume): independent student-paper archives (esp. opinion/letters), recorded
  lecture Q&A, student-org social accounts (check posting *recency*), student journals/radio.
- **Tier 2 — institutional but not promotional** (highest volume, reliably comparable):
  Common Data Set (the workhorse), IPEDS, accreditation self-studies, the events calendar
  for a random mid-semester weekday, student-government budget docs, org-directory *backends*.
- **Tier 3 — directional only** (texture, never verdicts): Reddit, Niche, College
  Confidential; Fulbright/Watson/NSF lists.

**Sampling discipline:** never sample orientation, admitted-students season, or homecoming
— use October or February. Read six *consecutive* weeks of the student paper (keyword
search finds what you expect; consecutive reading finds what's there). Pick a random
week-9 Tuesday for the events calendar and classify each event's host.

**Provenance is the point.** Every field carries its source, reporting period, and
confidence; every prose claim cites a reference with its tier and (for student media) its
provenance. A system that flattens news vs. op-ed vs. letter into "sources" loses real
findings — in calibration, an op-ed's published rebuttal *was* the finding.

## Browsing stack

- `WebSearch` — discovery (find a school's CDS, IPEDS, student-paper archive).
- `WebFetch` — grab page/PDF text fast (CDS PDFs; use `pdftotext` if you save one).
- `agent-browser` (separate skill) — JS-heavy work: org-directory backends with filter
  counts (the marketing-vs-backend test), student-media sites, screenshots for provenance.
- Video (lecture Q&A) can't be watched — pull captions/transcripts, else flag it for a human.

## Workflow loop

1. Pick a school (create `schools/<slug>.md` from `_template.md` if new).
2. For each criterion in scope, **read `criteria/<criterion>.md`** — it carries that
   criterion's source map and falsification tests.
3. Gather evidence per that criterion's workflow. Fill fields with full metadata; write
   the prose sections; add references.
4. **Run the criterion's falsification tests before accepting any positive finding.**
5. `node /app/skills/college-research/colleges.mjs validate <slug>` — fix every warning.
6. Surface the draft for review. Calcifer drafts; the family reviews — especially the
   Tier C prose and the falsification verdicts, which are deliberately human-judged.

## Tool commands

```bash
T="node /app/skills/college-research/colleges.mjs"
$T list                              # all schools + fill counts
$T missing <slug|all>                # unfilled fields — drives the workflow
$T compare sections_under_20_pct     # table across schools; auto-adds §4 companions
$T compare grad_rate_4yr presence_continuity_pct
$T derive <slug|all>                 # recompute derived fields from inputs (+ flag drift)
$T validate <slug|all>               # provenance, §4 pairing, and schema checks
```

The data is also plain text: `grep -r "reading group" $CORPUS/schools/`, or
`yq '.fields.engagement.grad_rate_4yr' $CORPUS/schools/northeastern.md`.

## Extending the schema (adding fields or a whole criterion)

Apply the same discipline that built the engagement criterion:

1. **Decompose first.** If a school can score high on one part and low on another, it's not
   one field. A new *criterion* gets its own `criteria/<name>.md` and a `criteria.<name>`
   block in `schema.yml`.
2. **Rank sources by resistance to manipulation** before collecting anything.
3. **Write the falsification test before the field.** If you can't state what evidence would
   make the field read wrong, it isn't ready.
4. **Test on a matched pair.** A field that can't separate two similar schools measures
   nothing at that resolution.
5. **Add pairings explicitly.** Any field that reads wrong alone gets a `pair_with` in
   `schema.yml`; the tool enforces it.
6. **Let some things stay prose.** The exposition zone is a first-class citizen, not a
   residue of what couldn't be structured.

Fields are `snake_case`. Derived fields store their formula in `schema.yml`, not in records.
Bump `schema_version` when you add or repair a field, and note in a record when a value was
carried forward under an older definition. **Resist premature abstraction:** don't factor a
generic "evidence model" doc out of a single criterion — wait until a second criterion shows
what is actually cross-cutting.
