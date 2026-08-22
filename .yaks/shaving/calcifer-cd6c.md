---
id: calcifer-cd6c
title: Establish wiki-backed memory contract (CLAUDE.local.md pointers)
type: task
priority: 2
created: '2026-08-22T15:17:05Z'
updated: '2026-08-22T15:42:24Z'
parent: calcifer-80c5
labels:
- memory
---

Define the durable-memory convention in the wikis (personal /workspace/extra/<user>-wiki/, shared /workspace/extra/shared/family-wiki/) and add a short contract to CLAUDE.local.md (and/or a shared fragment): where memory lives (personal vs family), when to consult it (start of task), when to update it (on learning a durable fact), and to keep CLAUDE.local.md itself to pinned essentials only. Pointers only — not content. Decide the convention: dedicated memory/ area vs woven into wiki structure.

---
▸ 2026-08-22T15:42:24Z
Convention decided: dedicated memory/ area per wiki, INDEX-FIRST retrieval. Rationale: agent's tools are Glob/Grep(lexical)/Read/Bash — no semantic search — so a bare dir pointer -> unpredictable ls+guess-reads. An index.md (short one-line entries + links to detail) gives one deterministic cheap read that answers most queries; follow links / grep-fallback for detail.

Done for dm-with-joel + shared: created family-wiki/memory/{index.md,people/jay.md} and joel-wiki/memory/index.md (host /home/joel/Seafile/...); added a 'Durable memory' contract to groups/dm-with-joel/CLAUDE.local.md (index-first, when to consult/update, keep entries short + link out, grep fallback, daily consolidation tidies).

REMAINING (mechanical rollout): same CLAUDE.local.md contract for dm-with-alicia (alicia-wiki) + the-hearth (family-only); alicia-wiki/memory scaffold. NOTE existing wikis already have human structure (joel-wiki/people, preferences; family-wiki/health, vehicles) — memory/ index can link OUT to those human docs for detail rather than duplicating.
