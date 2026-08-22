---
id: calcifer-de75
title: 'Optional: consolidation/reflection pass on top of upstream memory'
type: idea
priority: 4
created: '2026-08-22T15:17:05Z'
updated: '2026-08-22T19:05:50Z'
parent: calcifer-80c5
labels:
- memory
---

Scheduled nc task (schedule_task): periodically (weekly / after N conversations) read recent conversation transcripts, extract durable facts, classify personal vs family, dedupe against existing wiki memory docs, write updates to the right wiki (local files), refresh CLAUDE.local.md pinned essentials, prune stale. Reuses nc scheduling; low complexity. Depends on the memory contract (.2).

---
▸ 2026-08-22T19:05:19Z
OBVIATED as originally scoped (bespoke consolidator). Upstream relies on inline agent maintenance (definition.md doctrine), so a scheduled consolidator isn't needed to start. Parked as a possible future enhancement ON TOP of upstream memory: a periodic reflection pass over recent conversations that distills durable facts the agent missed inline. Revisit only after converging + living with upstream's inline model.
