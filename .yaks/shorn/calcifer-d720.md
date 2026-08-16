---
id: calcifer-d720
title: 'skill-views: Seafile view — tree/browser primitive + byte/download endpoint'
type: feature
priority: 2
created: '2026-07-07T22:27:43Z'
updated: '2026-08-16T15:07:57Z'
depends_on:
- calcifer-851f
labels:
- skill-views
- seafile
---

Stretch skill-views into a file browser over Seafile: navigate the folder hierarchy, see files, download/preview. New primitives: tree/browser (hierarchical nav) + a byte/download endpoint under the authed /api/views namespace (shares plumbing with attachments, calcifer-7c3a.3 — both stream bytes through the host). Data via data.type=http (custom-backend tier, calcifer-851f) against the Seafile skill/API (remote service, not workspace sqlite). Extracted from the retired calcifer-1d51.7 roadmap.

---
▸ 2026-08-15T15:26:09Z
DECISION (owner steer): generalize Seafile as LIBRARIES-AS-VIEWS. Each top-level Seafile library (local sync dir under FS_VIEW_ROOT: family-wiki, documents, books, pictures, roms, ...) is its own view/'thing' with its own config. Add a PRESENTATION dimension to the manifest (list-level primitive: 'list' cards | 'tree' browser | later 'gallery'), decoupled from the fs backend — so different libraries render differently over the same source. Byte endpoint (7b34.1) already done. This reframes d720 from 'the Seafile view' to 'pluggable presentation + libraries-as-views'; children below.

---
▸ 2026-08-16T15:07:57Z
WRAP-UP: Seafile libraries-as-views + pluggable presentation shipped. Delivered: fs data-source with path containment + browse mode (.1), multi-manifest loader views/*.json (.2), tree presentation + Documents (.3), gallery presentation + Books/Pictures + rail grouping (.5), server-side webp thumbnails w/ disk cache (.6), plus byte endpoint (7b34.1) and interactive record cards (2588) built alongside. Four libraries live (Family Wiki, Documents, Books, Pictures). Wiki called 'good enough' for v0; flat-vs-tree presentation revisit lifted to top-level idea calcifer-304a.
