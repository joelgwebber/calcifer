---
id: calcifer-851f
title: 'skill-views: custom-backend tier (data.type=http proxy + registerViewProvider)'
type: feature
priority: 2
created: '2026-07-07T22:27:26Z'
updated: '2026-07-07T22:27:26Z'
labels:
- skill-views
- web-ui
---

Second extensibility tier for skill-views (v0 was declarative-over-sqlite). Let a view's data come from custom logic, always BEHIND the host's authenticated /api/views/<view>/... namespace — never a parallel public port. Two mechanisms: (a) data.type='http' — host forwards the authed, scoped request to a skill-provided endpoint (the skill runs its own query/action logic and returns rows/records/facets in the same data-plane shape); (b) a registerViewProvider-style in-host module (mirrors the channel/provider install pattern; runs in-host with full privileges, so owner-gated). data.type is already an open enum in the manifest ('sqlite'|'http'|'agent'); the data-plane (src/views/data-plane.ts) currently implements sqlite only. This tier is the prerequisite for the Wiki and Seafile views, which aren't workspace sqlite. Extracted from the retired calcifer-1d51.7 roadmap.
