---
id: calcifer-574d
title: Add admissions + academic_programs criteria to college wiki schema
type: feature
priority: 3
created: '2026-08-23T14:37:08Z'
updated: '2026-08-23T14:37:11Z'
---

Added criteria/admissions.md and criteria/academic_programs.md plus corresponding schema.yml blocks (acceptance_rate_pct + admissions_process_type; per-subject *_offering_type for biology/linguistics/creative_writing/french). Updated schools/_template.md to scaffold both. Note: academic_programs *_offering_type pair_with prose is NOT machine-enforced by colleges.mjs validate (only checks frontmatter-to-frontmatter pairing) — documented in the criteria doc as a manual-discipline pairing instead of using the (non-functional for this case) pair_with mechanism.
