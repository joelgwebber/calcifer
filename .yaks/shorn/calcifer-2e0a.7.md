---
id: calcifer-2e0a.7
title: 'restart_serve: stop+start serve atomically, or auto-replace'
type: feature
priority: 3
created: '2026-04-24T15:41:04Z'
updated: '2026-04-24T18:15:09Z'
parent: calcifer-2e0a
---

Currently serve_project blocks if a serve is already running, requiring a manual stop_serve first. Add a restart_serve IPC tool (and MCP tool) that stops any existing serve run and starts a new one atomically. Alternatively, make serve_project auto-replace by default with an optional force flag. Useful after a build completes and you want to pick up the new workspace state without the two-step dance.
