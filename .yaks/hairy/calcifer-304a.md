---
id: calcifer-304a
title: 'Revisit wiki presentation: flat list vs tree vs sectioned (owner unsure flat
  is right)'
type: idea
priority: 3
created: '2026-08-15T15:26:09Z'
updated: '2026-08-23T15:12:45Z'
labels:
- skill-views
- wiki
---

---
▸ 2026-08-23T15:12:45Z
Provenance value-cell renderer shipped (web-only, live on rebuild+refresh): ViewDetail recognizes {value, source_url, notes, ...} objects and renders one compact row (value headline + source link + muted key:value byline + notes disclosure) vs a 7-row subtree. Only value/source_url/notes special-cased; as_of/confidence/retrieved/etc degrade to chips. Deliberate limit = boundary for a future per-type render schema (format 57->57%, order fields, hide retrieved), keyed by OKF type + reusing colleges/schema.yml.
