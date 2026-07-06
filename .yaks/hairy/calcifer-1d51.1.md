---
id: calcifer-1d51.1
title: Host annotations store (shared) + API
type: task
priority: 2
created: '2026-07-06T18:20:31Z'
updated: '2026-07-06T18:20:31Z'
labels:
- skill-views
---

Shared family-wide annotations for view entities (owner: not per-user). Central-DB table annotations(skill, entity_id, key, value, updated_at). Host-owned so the skill fact DB stays single-writer. API: POST /api/annotations upsert/clear + a read helper to fetch annotations for a set of entity_ids (for data-plane merge). Behind existing web auth. Acceptance: star/unstar persists via API; annotations readable for merge.
