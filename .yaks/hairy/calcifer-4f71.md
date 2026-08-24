---
id: calcifer-4f71
title: 'A3: Mobile drawer — unified sidebar as overlay'
type: task
priority: 2
created: '2026-08-23T22:03:21Z'
updated: '2026-08-24T04:10:53Z'
parent: calcifer-2520
depends_on:
- calcifer-633d
- calcifer-b123
labels:
- web-ui
---

Mobile (<600) presentation of the SAME unified sidebar from A2, rendered as a single overlay drawer with the Apps + Conversations sections (one affordance, thumb-reachable). Drawer hygiene: backdrop click + ESC to close, focus-trap, swipe-to-close, and safe-area-inset-* padding for the coming native wrapper. Context-aware header hamburger opens it. Driven by the A1 nav-visibility state.

---
▸ 2026-08-23T23:10:56Z
Repurposed from 'collapsible conversations list' to the mobile-drawer presentation of the unified sidebar per decision #1; absorbed the old A4 (merged drawer).

---
▸ 2026-08-24T04:10:53Z
Largely delivered by A2: the SAME unified rail already renders as the mobile overlay drawer (fixed slide-in + backdrop, full Apps+Conversations+Sign out content, chat full-width behind). Verified live at 390px. REMAINING A3 scope is polish only: swipe-to-close, focus-trap, and safe-area-inset padding for the native wrapper.
