---
id: calcifer-d720
title: 'skill-views: Seafile view — tree/browser primitive + byte/download endpoint'
type: feature
priority: 2
created: '2026-07-07T22:27:43Z'
updated: '2026-07-07T22:27:43Z'
depends_on:
- calcifer-851f
labels:
- skill-views
- seafile
---

Stretch skill-views into a file browser over Seafile: navigate the folder hierarchy, see files, download/preview. New primitives: tree/browser (hierarchical nav) + a byte/download endpoint under the authed /api/views namespace (shares plumbing with attachments, calcifer-7c3a.3 — both stream bytes through the host). Data via data.type=http (custom-backend tier, calcifer-851f) against the Seafile skill/API (remote service, not workspace sqlite). Extracted from the retired calcifer-1d51.7 roadmap.
