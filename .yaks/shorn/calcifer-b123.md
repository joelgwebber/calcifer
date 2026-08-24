---
id: calcifer-b123
title: 'A2: Unified navigation sidebar (Apps + Conversations sections, desktop collapse)'
type: task
priority: 2
created: '2026-08-23T22:03:21Z'
updated: '2026-08-24T04:10:53Z'
parent: calcifer-2520
depends_on:
- calcifer-633d
labels:
- web-ui
---

The single left surface for desktop/tablet. One sidebar with sections: Apps (the current rail's view links) and Conversations (the thread list) — replacing today's two-column rail + conversations sidebar. Collapses to an icon strip on desktop (view manifests carry an 'icon'); collapse state persisted (from A1). New chat button pinned at top. Per-conversation rows carry a tap-first overflow (⋯) menu (consumed by B1/B2). This is the component A3 re-renders as a mobile drawer.

---
▸ 2026-08-23T23:10:56Z
Repurposed from 'collapsible app rail' to the unified sidebar (Apps + Conversations in one surface) per decision #1.

---
▸ 2026-08-24T04:10:52Z
COMPLETE (verified live via sightmap at 1280px, collapsed strip, and 390px). Moved the Conversations list (ThreadList) out of ChatPane into the rail as an always-visible section below Apps/Libraries; chat route is now just the full-width transcript+composer (fixes the mobile squeeze). Rail links carry an icon (💬 Chat; manifest icon -> emoji: book/building/folder/image; monogram fallback) + label. Desktop collapse is now a 56px ICON STRIP (was full-hide in A1): labels/sections/brand/conversations hide, glyphs center, expand chevron in header. Files: web/src/App.tsx, web/src/styles.css.
