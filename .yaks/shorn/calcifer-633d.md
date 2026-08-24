---
id: calcifer-633d
title: 'A1: Responsive layout foundation — breakpoints, single-surface nav state, grid architecture'
type: task
priority: 2
created: '2026-08-23T22:03:12Z'
updated: '2026-08-24T03:46:43Z'
parent: calcifer-2520
depends_on:
- calcifer-814d
labels:
- web-ui
---

The spine of spine A. Now targets a SINGLE unified left nav surface (decision: unify desktop too, not just mobile — every surveyed agent UI uses one collapsible sidebar, not a rail + conversations column). Establish: (1) breakpoints desktop >=1024 / tablet ~600-1024 / mobile <600; (2) a shared nav-visibility state (expanded | collapsed | hidden) x mode, persisted to localStorage; (3) the CSS Grid architecture that renders that state as sidebar+thread -> collapsed+thread -> drawer+thread. Render the state; don't duplicate branches. Prefer CSS visibility over unmount so scroll/state persist. Fold in cross-cutting polish: skeleton/empty/loading states and prefers-reduced-motion. Scaffold only — A2 (desktop sidebar) and A3 (mobile drawer) build the actual surface on this.

---
▸ 2026-08-23T23:10:46Z
Reframed from 'rail + conversations as two columns' to a single unified nav surface per decision #1. Old A2/A3/A4 (separate collapsible rail, separate conversations, separate merged drawer) collapsed into: A2 = unified sidebar (desktop), A3 = same surface as mobile drawer. Absorbed polish item #5.

---
▸ 2026-08-24T03:46:43Z
COMPLETE (verified live via sightmap at 1280px + 390px). Added web/src/ui/layout.ts: useLayoutMode() breakpoint hook (mobile<600, tablet<1024, desktop) + useNav zustand store (collapsed persisted to localStorage, ephemeral drawerOpen). Restructured App.tsx Shell: responsive CSS-grid shell, in-rail collapse chevron (desktop), floating hamburger to re-open (desktop collapsed) / open drawer (mobile), backdrop, drawer auto-closes on route change / leaving mobile. styles.css: .shell grid (200px|1fr -> 0|1fr collapsed -> 1fr mobile), rail as fixed slide-in drawer on mobile, backdrop, prefers-reduced-motion. Confirmed: desktop collapse hides rail + shows hamburger; mobile rail becomes overlay drawer w/ backdrop. NOTE: the chat route's OWN internal sidebar+pane split (ChatPane) is still a fixed two-column and squeezes on mobile — that's A2 (merge Conversations into the single nav surface) + A3 (mobile drawer content).
