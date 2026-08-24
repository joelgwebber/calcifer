---
id: calcifer-7dd1
title: 'C1: Consolidate theme tokens into documented light/dark :root (calcifer/hearth palette)'
type: task
priority: 2
created: '2026-08-23T22:03:48Z'
updated: '2026-08-24T04:40:15Z'
parent: calcifer-4861
depends_on:
- calcifer-814d
labels:
- web-ui
---

Gather the scattered CSS custom properties (--accent, --muted, --border, --fg, ...) into ONE documented :root block with a light and a dark set via prefers-color-scheme. Introduce a warmer, less-sterile 'calcifer/hearth' palette (ember/firelight accents, cozy but legible) informed by the research pass (814d). Subtle thematic nod only — no nanoclaw branding anywhere. Scope: tokens + docs; no user-facing theme toggle beyond light/dark.

---
▸ 2026-08-24T04:40:15Z
COMPLETE (light verified live via sightmap; dark verified by injecting the dark-block token values). Consolidated all CSS custom properties into one documented :root (light 'hearthstone') + @media(prefers-color-scheme:dark) ('banked coals'). Warm ember/firelight palette, accent used sparingly. Added semantic tokens: --fg (alias of --text, fixes the view CSS that referenced an undefined --fg), --accent-soft (was hardcoded blue rgba active-highlight), --hover-bg/--hover-bg-strong (so hovers work in dark), --star, --danger. Swept hardcoded literals to tokens (blue #3b82f6/#3b6ef5 accents, muted grays #9ca3af/#6b7280/#4b5563, star golds, danger red, text-on-accent whites). Killed the nanoclaw brand leaks -> 'hearth' (rail brand in ember, login title, composer placeholder). Files: web/src/styles.css, App.tsx, ui/Thread.tsx, ui/Login.tsx.
