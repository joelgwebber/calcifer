---
id: calcifer-f798
title: '''OKF alignment: where structured data lives (frontmatter vs body vs linked'
type: idea
priority: 3
created: '2026-08-23T16:34:30Z'
updated: '2026-08-23T18:02:08Z'
labels:
- okf
- memory
- wiki
- college-research
---

OKF's grain favors lean concept files (headlines+pointers) with raw/structured source data as linked resources (external or saved files) + a Citations section ('remember the approach, not the instance'). Our college records do the opposite: heavy structured data inline in frontmatter so colleges.mjs can grep/yq it. Consider reconciling for structured, cross-linked research docs + memories operable at agent-loop scale. Options: (a) keep queryable structured data in frontmatter (machine-first, renders heavy); (b) push structured data into body tables (readable/greppable, less machine-addressable); (c) lean concept + linked resource, OKF-native (the CDS PDF is the resource; distill+cite). Tension = tool queryability vs OKF leanness vs render density; likely resolve per use-case. Stay aligned with nc norms (OKF memory subsystem, resource/citations, index-first). Design consideration; no change yet. Relates to the render-schema yak.

---
▸ 2026-08-23T18:02:08Z
Resolved in practice: shrank frontmatter to minimum comparability (bare scalars), pushed detail/sourcing to greppable prose, loose references, corpus index.md as OKF map (agent-maintained, not auto-injected memory). 16k cap is memory-tree-only; corpus lives in wiki, reached via index+grep. Render-schema (7682) now largely moot for this corpus since bare values render fine.
