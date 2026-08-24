---
id: calcifer-1d15
title: College research skill — wiki-native structured+qualitative college corpus
type: feature
priority: 2
created: '2026-08-22T21:52:59Z'
updated: '2026-08-23T18:02:08Z'
labels:
- college-research
- wiki
- skills
---

Collaborative college-research skill for Anais's college search. Design (settled with owner): wiki-native markdown-with-YAML-frontmatter, one file per school, NOT the nyc-apt views/DB app (small N, evolving schema, half the value is irreducible prose per college-criteria.md §5.2). Lives in family-wiki (/workspace/extra/shared/family-wiki/colleges/). Structured header (Tier A/B fields + refs) in frontmatter; exposition + references in body. A versioned container skill (container/skills/college-research/) ships the methodology (SKILL.md) + a thin Node .mjs query/validate tool (list, compare-with-§4-pairing-enforcement, derive, validate, missing) that reads schema.yml as source of truth. Criterion is first-class (criteria.<name> in schema + records) so adding majors/class-size/research/cost later never rewrites records. Browsing stack already sufficient: WebSearch+WebFetch+agent-browser (no Tavily needed; only gap is watching lecture Q&A video). v0: engagement criterion migrated from college-criteria.md; seeding real NEU/BU records is a first real run (owner/Calcifer research — values must not be fabricated). Promotion seam: frontmatter can later project to a read-only colleges.db + view.json for a browsable web view without changing the source of truth. Defer factoring a generic evidence-model 'method.md' out until criterion #2 exists (avoid premature abstraction, per §8.1).

---
▸ 2026-08-23T15:12:45Z
OKF alignment: college records are OKF concepts now (type: college first frontmatter line). Renamed our conflicting institution-category key type -> institution_type (type is OKF-reserved). Template + SKILL.md updated. TODO: existing schools/northeastern.md still has old type: large-urban-research + frontmatter references; Calcifer is cleaning refs in background — also needs type->institution_type + add type: college (do NOT edit while Calcifer has it open).

---
▸ 2026-08-23T18:02:08Z
Lean OKF migration DONE + verified (shell restored). All 19 records lean (bare criterion-grouped scalars); 18 Alicia records migrated via one-off script (dropped mailto:aliciawbbr citations -> loose prose note; 0 mailto left). Northeastern hand-migrated (prose verbatim + synthesis). colleges.mjs rewritten lean+tolerant, smoke-tested (list/compare/derive/validate all green; derive orgs_per_1000=19.83). schema.yml lean across 3 criteria (engagement/admissions/academic_programs) + admissions_process_type registered. index.md OKF map added. Committed a174da61 + follow-up. Deferred: criteria/*.md still describe heavier provenance (tool ignores; reconcile later); memory->wiki pointer left for owner's test.
