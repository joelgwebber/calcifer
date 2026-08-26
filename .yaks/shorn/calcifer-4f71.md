---
id: calcifer-4f71
title: 'A3: Mobile drawer — unified sidebar as overlay'
type: task
priority: 2
created: '2026-08-23T22:03:21Z'
updated: '2026-08-26T01:02:11Z'
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

---
▸ 2026-08-26T01:02:11Z
Done. Mobile drawer hygiene on top of the existing slide-in: ESC-to-close, focus-trap (Tab wrap + a focusin guard that reclaims focus if it escapes), focus moved into the drawer on open + restored to the opener on close, body scroll-lock, role=dialog/aria-modal, swipe-left-to-close, safe-area insets (+ viewport-fit=cover), and visibility:hidden when closed so the off-screen drawer is out of the tab order / a11y tree. Learnings: (1) focus() during the opening commit no-ops because the drawer is still computed visibility:hidden mid-transition — defer ~80ms; (2) assistant-ui's composer autoFocus grabs focus on the chat page, so the composer now yields autoFocus while the drawer is open AND the focusin guard reclaims it. Verified live via the sightmap session at 414px. Files: web/index.html, web/src/ui/layout.ts (useDrawerA11y), web/src/App.tsx, web/src/ui/Thread.tsx, web/src/styles.css.
