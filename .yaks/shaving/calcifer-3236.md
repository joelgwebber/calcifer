---
id: calcifer-3236
title: 'B0: Thread-metadata persistence — central DB table + web adapter CRUD'
type: task
priority: 1
created: '2026-08-23T22:03:28Z'
updated: '2026-08-23T23:16:15Z'
parent: calcifer-5bf0
labels:
- web-ui,db
---

Foundational blocker for B1-B5. Add a central-DB table keyed on (messaging_group_id, thread_id) holding: title override (nullable; fall back to first-message truncation), archived_at (nullable), created_at/updated_at. RESERVE these columns now (free, avoids a second migration): pinned (B5), sort_order, and a nullable folder_id/project_id for future project grouping + artifact association (see the hosted-artifacts idea). Add web-adapter endpoints: PATCH /api/threads/:id (rename), archive/unarchive. Wire listThreads() to merge the title override and filter archived out by default; make the client store's renameThread persist instead of being clobbered by hydrateThreadList. Migration under src/db/migrations/. See docs/db-central.md.

---
▸ 2026-08-23T23:11:20Z
Added forward-compat reserved columns (pinned, sort_order, folder_id/project_id) per decision #4, sized to also cover the future hosted-artifacts direction.

---
▸ 2026-08-23T23:16:15Z
CHECKPOINT — persistence foundation landed + green (tsc clean, 5/5 tests pass):
- Migration src/db/migrations/026-thread-metadata.ts: table thread_meta PK (messaging_group_id, thread_id) — title override (nullable), archived_at (nullable), pinned, sort_order + folder_id reserved, created_at/updated_at; idx on (messaging_group_id, archived_at). Registered in migrations/index.ts (version 26, next calcifer-local after 025).
- Module src/db/thread-meta.ts: getThreadMeta, getThreadMetaFor (batch, for the listThreads merge), getArchivedThreadIds, setThreadTitle/setThreadArchived/setThreadPinned (field-scoped upserts — a rename never disturbs archive state, etc.). Family-shared, not per-user (mirrors annotations).
- Test src/db/thread-meta.test.ts (5 cases).

REMAINING for B0 (next slices):
1. web-history.ts listThreads(): merge title override (getThreadMetaFor) + filter archived out; add listArchivedThreads(platformId). Thread identity = (mg.id, session.thread_id).
2. web.ts endpoints: PATCH /api/threads/:id (rename), archive/unarchive (+ GET archived). Handlers resolve platformId->mg like the existing /api/threads + /api/history handlers.
3. Client store: make renameThread persist (call PATCH) and stop hydrateThreadList from clobbering overrides; surface archived filtering. UI affordances themselves are B1/B2/B3/B4.
