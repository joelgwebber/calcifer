---
id: calcifer-7dd1
title: 'C1: Consolidate theme tokens into documented light/dark :root (calcifer/hearth palette)'
type: task
priority: 2
created: '2026-08-23T22:03:48Z'
updated: '2026-08-23T22:03:48Z'
parent: calcifer-4861
depends_on:
- calcifer-814d
labels:
- web-ui
---

Gather the scattered CSS custom properties (--accent, --muted, --border, --fg, ...) into ONE documented :root block with a light and a dark set via prefers-color-scheme. Introduce a warmer, less-sterile 'calcifer/hearth' palette (ember/firelight accents, cozy but legible) informed by the research pass (814d). Subtle thematic nod only — no nanoclaw branding anywhere. Scope: tokens + docs; no user-facing theme toggle beyond light/dark.
