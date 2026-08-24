---
id: calcifer-d1a0
title: 'Wiki prose: render [id] inline citations as links to their reference'
type: feature
priority: 3
created: '2026-08-23T16:34:30Z'
updated: '2026-08-23T16:34:30Z'
labels:
- skill-views
- wiki
---

Records cite references inline as [cds-2024-25]-style footnote anchors and list them in a ## References section. Prose renderer (web/src/views/Prose.tsx) shows [id] as literal text, not links. Make [id] tokens that match a reference entry render as in-page links (anchor to the reference item, or a hover popover with the citation). Lightweight footnote pass in Prose: map [id] -> #ref-<id> anchor and add matching ids to the References list items. Stay within the existing markdown pipeline; no heavy footnote lib.
