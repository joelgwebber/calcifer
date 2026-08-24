---
id: calcifer-88d2
title: 'B1: Rename conversations'
type: task
priority: 2
created: '2026-08-23T22:03:38Z'
updated: '2026-08-23T22:03:38Z'
parent: calcifer-5bf0
depends_on:
- calcifer-3236
labels:
- web-ui
---

Per-conversation rename via a tap-first overflow (⋯) menu on each thread-list item (not a hover reveal). Wire to the B0 PATCH endpoint so the override title persists across reload. Empty/reset clears the override and falls back to the first-message title.
