---
id: calcifer-da67.2
title: Find a better approach to maintaining family CLAUDE.mds
type: bug
priority: 2
created: '2026-03-09T02:14:45Z'
updated: '2026-04-19T03:25:11Z'
commit: 9d10252
---

The default approach is to manually edit every member's CLAUDE.md to ensure that it only
mentions tools that are enabled for them. This is quite error-prone.

## Approach

This is now addressed by the da67.5 container skills extraction work:

- Tool docs move out of CLAUDE.md entirely → into container/skills/
- Each skill has an env-var guard (absent key = skill silent)
- CLAUDE.md becomes lean persona only (~100 lines), identical across members except for name/facts
- Per-user tool access is controlled by groups/{folder}/.env, not by editing CLAUDE.md

See calcifer-da67.5 and calcifer-da67.7 for implementation.
