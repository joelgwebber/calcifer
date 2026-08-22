---
id: calcifer-1d15
title: College research skill — wiki-native structured+qualitative college corpus
type: feature
priority: 2
created: '2026-08-22T21:52:59Z'
updated: '2026-08-22T21:52:59Z'
labels:
- college-research
- wiki
- skills
---

Collaborative college-research skill for Anais's college search. Design (settled with owner): wiki-native markdown-with-YAML-frontmatter, one file per school, NOT the nyc-apt views/DB app (small N, evolving schema, half the value is irreducible prose per college-criteria.md §5.2). Lives in family-wiki (/workspace/extra/shared/family-wiki/colleges/). Structured header (Tier A/B fields + refs) in frontmatter; exposition + references in body. A versioned container skill (container/skills/college-research/) ships the methodology (SKILL.md) + a thin Node .mjs query/validate tool (list, compare-with-§4-pairing-enforcement, derive, validate, missing) that reads schema.yml as source of truth. Criterion is first-class (criteria.<name> in schema + records) so adding majors/class-size/research/cost later never rewrites records. Browsing stack already sufficient: WebSearch+WebFetch+agent-browser (no Tavily needed; only gap is watching lecture Q&A video). v0: engagement criterion migrated from college-criteria.md; seeding real NEU/BU records is a first real run (owner/Calcifer research — values must not be fabricated). Promotion seam: frontmatter can later project to a read-only colleges.db + view.json for a browsable web view without changing the source of truth. Defer factoring a generic evidence-model 'method.md' out until criterion #2 exists (avoid premature abstraction, per §8.1).
