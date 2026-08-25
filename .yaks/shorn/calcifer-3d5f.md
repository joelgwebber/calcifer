---
id: calcifer-3d5f
title: 'B5: Conversation list — time-bucketing + pinning'
type: task
priority: 3
created: '2026-08-23T23:11:07Z'
updated: '2026-08-25T02:21:33Z'
parent: calcifer-5bf0
depends_on:
- calcifer-3236
labels:
- web-ui
---

Group the active conversation list into time buckets (Today / Yesterday / Last 7 days / older) and support pinning a conversation to the top. Near-universal across surveyed agent UIs and cheap given B0's metadata table (uses updated_at + a pinned flag). Pin toggle lives in the per-row overflow menu alongside rename/archive.
