---
id: calcifer-1d51.3
title: Views data-plane read API (sqlite, read-only, annotation merge)
type: task
priority: 2
created: '2026-07-06T18:20:31Z'
updated: '2026-07-06T18:20:31Z'
depends_on:
- calcifer-1d51.1
- calcifer-1d51.2
labels:
- skill-views
---

GET /api/views/<view>/data?collection=&filters=&sort=&page= and .../record/<id> (auth-gated). v0 data.type=sqlite: open the skill workspace DB READ-ONLY (groups/<folder>/<path>); build PARAMETERIZED queries from manifest-declared filter/sort/search fields + collection presets (no raw SQL from skills); merge shared annotations (.1) by entity_id; return {items,total,page}. Acceptance: apartments recent/starred/filtered/sorted/paginated queries return correct merged rows; unauth 401.
