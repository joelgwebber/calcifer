---
id: calcifer-1d51.1
title: Host annotations store (shared) + API
type: task
priority: 2
created: '2026-07-06T18:20:31Z'
updated: '2026-07-06T18:34:19Z'
labels:
- skill-views
parent: calcifer-1d51
---

Shared family-wide annotations for view entities (owner: not per-user). Central-DB table annotations(skill, entity_id, key, value, updated_at). Host-owned so the skill fact DB stays single-writer. API: POST /api/annotations upsert/clear + a read helper to fetch annotations for a set of entity_ids (for data-plane merge). Behind existing web auth. Acceptance: star/unstar persists via API; annotations readable for merge.

---
▸ 2026-07-06T18:34:19Z
Done. Migration 017 annotations(skill,entity_id,key,value,updated_at) + src/db/annotations.ts (set/clear/getAnnotationsFor/getEntityIdsWithAnnotation). Host-owned, shared (no user dim). POST /api/annotations wired in web.ts (view+entity_id+key+value; validates key against manifest.annotations). Verified: star persisted + surfaced in starred collection + merged into row _ann.
