---
id: calcifer-de75
title: 'Consolidation task: transcripts -> wiki memory docs + CLAUDE.local.md'
type: task
priority: 3
created: '2026-08-22T15:17:05Z'
updated: '2026-08-22T15:17:17Z'
parent: calcifer-80c5
labels:
- memory
depends_on:
- calcifer-cd6c
---

Scheduled nc task (schedule_task): periodically (weekly / after N conversations) read recent conversation transcripts, extract durable facts, classify personal vs family, dedupe against existing wiki memory docs, write updates to the right wiki (local files), refresh CLAUDE.local.md pinned essentials, prune stale. Reuses nc scheduling; low complexity. Depends on the memory contract (.2).
