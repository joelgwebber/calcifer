---
id: calcifer-0917
title: 'skill-views: far tiers — sandboxed iframe custom render + live SSE view updates'
type: idea
priority: 4
created: '2026-07-07T22:27:43Z'
updated: '2026-07-07T22:27:43Z'
labels:
- skill-views
---

Far-horizon skill-views tiers (keep data.type + primitive/action sets as OPEN enums so these slot in without redesign). (a) Sandboxed custom render: an iframe + postMessage bridge lets a skill ship its own render code safely (MCP-Apps-inspired) for cases the fixed primitive vocabulary can't express. (b) Live view updates: push data-plane changes to open views over SSE (reuse the web channel's stream), so a view refreshes as the underlying store changes. Extracted from the retired calcifer-1d51.7 roadmap.
