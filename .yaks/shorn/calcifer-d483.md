---
id: calcifer-d483
title: Web UI overhaul — responsive shell, conversation management, theming
type: feature
priority: 2
created: '2026-08-23T22:02:34Z'
updated: '2026-08-26T13:38:54Z'
labels:
- web-ui
---

Umbrella herd for the next web UI iteration (supersedes the ad-hoc growth under 7c3a). Three independent spines:

A · Responsive layout & unified navigation — mobile-first, single-column on phones, a single merged drawer (Chat / Apps / Conversations) on mobile, independently collapsible rail + conversations on desktop.
B · Conversation management — rename, archive (soft-delete), archive browsing/search, rescue. Requires new server-side thread metadata (today titles are recomputed from the first message and client rename/delete are non-persistent).
C · Theming — consolidate CSS custom properties into one documented light/dark :root with a warmer, less-sterile 'calcifer/hearth' visual direction. NOT nanoclaw branding (that is an implementation detail). No user-toggled styling beyond light/dark.

Spine roots (A1, B0, C1) are independent; the A/B/C grouping is for hygiene/clarity, not parallel execution (no worktrees yet). A design-research pass precedes layout/theming implementation.

---
▸ 2026-08-26T13:38:54Z
Web UI overhaul complete. Spine A (responsive single-surface nav + mobile drawer + Cmd+K): done. Spine B (conversation rename/archive/rescue + time-bucketing/pin on the thread_meta foundation): done. Spine C (hearth light/dark theme): done. Plus the wiki-link and width/sort fixes along the way. 7e1f (hosted multi-file artifacts) hoisted to root for later.
