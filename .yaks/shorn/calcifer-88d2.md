---
id: calcifer-88d2
title: 'B1: Rename conversations'
type: task
priority: 2
created: '2026-08-23T22:03:38Z'
updated: '2026-08-24T04:33:53Z'
parent: calcifer-5bf0
depends_on:
- calcifer-3236
labels:
- web-ui
---

Per-conversation rename via a tap-first overflow (⋯) menu on each thread-list item (not a hover reveal). Wire to the B0 PATCH endpoint so the override title persists across reload. Empty/reset clears the override and falls back to the first-message title.

---
▸ 2026-08-24T04:33:53Z
COMPLETE (verified live via sightmap incl. reload persistence). Per-conversation tap-first (⋯) overflow menu on each thread row (web/src/ui/ThreadList.tsx via useThreadListItemRuntime). Rename = inline input (Enter commits / Esc cancels / blur commits), routed through item.rename -> adapter onRename -> store + POST /api/threads/rename. Confirmed the override persists across reload (thread_meta + listThreads merge). Needed a host rebuild+restart to deploy B0/B1 (service runs dist/); also had to clear the upgrade tripwire via scripts/upgrade-state.ts set after local commits.
