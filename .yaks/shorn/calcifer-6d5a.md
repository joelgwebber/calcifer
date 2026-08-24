---
id: calcifer-6d5a
title: 'B2: Archive conversation (soft-delete)'
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

Archive action in the same overflow menu; sets archived_at via B0 and removes the thread from the default conversations list. Archive is the primary destructive action — demote or remove hard delete from the main UI.

---
▸ 2026-08-24T04:33:53Z
COMPLETE (verified live via sightmap incl. reload). Archive action in the same (⋯) menu -> item.archive() -> new adapter onArchive (runtime.tsx): drops the thread from the active list locally + POST /api/threads/archive {archived:true}. Confirmed the thread vanishes from the active list and stays hidden after reload (listThreads filters archived_at). Rescue/unarchive UI + the archive browser are B4/B3 (onUnarchive not wired yet; endpoint + listArchivedThreads already exist from B0).
