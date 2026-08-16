---
id: calcifer-1d51.2
title: View manifest format + host loader/registry
type: task
priority: 2
created: '2026-07-06T18:20:31Z'
updated: '2026-07-06T18:34:19Z'
labels:
- skill-views
parent: calcifer-1d51
---

Static view-manifest schema + host loader. Schema: view,title,icon,data{type: sqlite|http|agent, path, table}, fields{name:{type,label,filter,sort,search}}, collections{name:{label,filter,annotation,sort}}, list{card{...}}, detail{...}, annotations[]. Field types: text/money/datetime/number/bool/badge/image/link/keyvalue. Loader discovers manifests from installed skills, validates, builds an in-memory registry keyed by view name. Acceptance: apartments manifest loads; GET /api/views lists views (auth-gated).

---
▸ 2026-07-06T18:34:19Z
Done. src/views/manifest.ts — types + validate + registry scanning container/skills/*/view.json. data.type/field-type/action sets are OPEN enums (wiki/seafile later). GET /api/views wired (auth-gated). Verified apartments manifest loads into registry.
