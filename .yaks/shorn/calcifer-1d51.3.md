---
id: calcifer-1d51.3
title: Views data-plane read API (sqlite, read-only, annotation merge)
type: task
priority: 2
created: '2026-07-06T18:20:31Z'
updated: '2026-07-06T18:34:19Z'
depends_on:
- calcifer-1d51.1
- calcifer-1d51.2
labels:
- skill-views
parent: calcifer-1d51
---

GET /api/views/<view>/data?collection=&filters=&sort=&page= and .../record/<id> (auth-gated). v0 data.type=sqlite: open the skill workspace DB READ-ONLY (groups/<folder>/<path>); build PARAMETERIZED queries from manifest-declared filter/sort/search fields + collection presets (no raw SQL from skills); merge shared annotations (.1) by entity_id; return {items,total,page}. Acceptance: apartments recent/starred/filtered/sorted/paginated queries return correct merged rows; unauth 401.

---
▸ 2026-07-06T18:34:19Z
Done. src/views/data-plane.ts queryView/getViewRecord: reads workspace sqlite READ-ONLY, fully parameterized + column-whitelisted via PRAGMA table_info; baseFilter + collection(filter/annotation) + client filters (range/multiselect/toggle/daterange/search) + q search; sort whitelist (client sort gated on field.sort); pagination; facets for multiselect; annotation merge into _ann; detail timeline (related rows). web glue src/channels/web-views.ts resolves user->web mg->wiring->agent-group folder; /api/views, /api/views/<v>/data, /api/views/<v>/record/<id>, /api/annotations wired auth-gated in web.ts. Verified end-to-end vs groups/dm-with-joel/nyc-apt/listings.db: recent/filter/sort/facets/starred/record+timeline all correct. NOTE for .5: web:joel is wired to The Hearth but apt data lives in dm-with-joel workspace -> wiring must be aligned.
