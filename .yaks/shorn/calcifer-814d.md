---
id: calcifer-814d
title: 'Research: agent-UI design patterns + calcifer/hearth visual direction'
type: task
priority: 2
created: '2026-08-23T22:02:45Z'
updated: '2026-08-23T23:11:33Z'
parent: calcifer-d483
labels:
- web-ui,research
---

Pre-implementation design pass. Two questions:

1. Layout/interaction patterns from mature agent UIs (ChatGPT, Claude.ai, T3 Chat, Open WebUI, LibreChat, etc.): how they handle collapsible nav + conversation lists, the mobile single-column + drawer transition, rename/archive affordances (tap-first overflow menus, not hover reveals), and archive discovery/search.
2. Visual direction: how to make the current sterile shell warmer with a subtle nod to the 'calcifer/hearth' concept (warm ember/firelight accents, cozy but legible) — WITHOUT nanoclaw branding. Feed findings into A1 (layout) and C1 (theme tokens).

Deliverable: a short written summary + concrete recommendations that A1 and C1 build on. No code.

---
▸ 2026-08-23T23:11:33Z
RESEARCH COMPLETE. Survey (ChatGPT, Claude.ai, T3 Chat, Open WebUI, LibreChat): all use ONE collapsible left sidebar (not a nav-rail + conversation-column split); per-row (⋯) kebab is the universal rename/archive affordance (always-present on touch); archive lives in a separate list reachable from sidebar footer/settings with per-row unarchive + name search; time-bucketing + pin are near-universal; projects/folders grouping is where they're all heading.

Decisions resolved: (1) unify desktop nav into one surface -> reshaped A1/A2/A3, slaughtered old A4; (2) time-bucketing+pin -> new B5; (3) Cmd+K palette -> new A4; (4) B0 reserves pinned/sort_order/folder_id/project_id; (5) skeleton+reduced-motion folded into A1. Future hosted-artifacts direction captured as idea 7e1f.

Findings for C1: current tokens are inconsistent — --fg is referenced in view CSS but never defined (reconcile with --text); accent is #3b6ef5 in :root but #3b82f6 is hardcoded elsewhere; muted literals #9ca3af/#6b7280/#4b5563 scattered; NO dark mode. Hearth palette (accent used sparingly like firelight): LIGHT hearthstone bg #faf7f2 / surface #f3ece2 / border #e7ded2 / text #241f1c / muted #8a7f76 / accent(ember) #c8552b. DARK banked-coals bg #17130f / surface #221c17 / border #332a22 / text #f0e9e0 / muted #a89a8c / accent #ec8a52 (brightened to glow). AA-check accent-on-bg. Subtle nod only, no wordmark.
