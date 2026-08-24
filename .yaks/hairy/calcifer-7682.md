---
id: calcifer-7682
title: 'Wiki view: per-type render schema for structured frontmatter'
type: idea
priority: 3
created: '2026-08-23T16:34:30Z'
updated: '2026-08-23T16:34:30Z'
labels:
- skill-views
- wiki
- okf
---

The generic provenance value-cell heuristic (shipped fa462167) is a good ~80% default but has a hard ceiling: can't format by field type (57->57%, 4000000->$4M), can't order/prioritize or hide low-signal fields (retrieved), shows raw key names in chips, and renders every cell identically regardless of concept. Dig into a per-type render schema keyed off the OKF type frontmatter (e.g. type: college) and REUSING the field registry we already have (colleges/schema.yml: types, labels, units, pairings). Renderer resolves record type -> render profile -> formats/orders/labels/hides value cells; falls back to the generic heuristic for unknown types. Open Q: does the profile live in the view manifest, a per-dir file, or derive from schema.yml? Generalizes to OKF memory concepts too (same md+frontmatter family). Do NOT over-iterate the raw heuristic; design the schema seam.
