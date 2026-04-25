---
id: calcifer-da67.4
title: Replace hardcoded credential injection with dynamic env-var passthrough
type: feature
priority: 1
created: '2026-04-18T22:48:40Z'
updated: '2026-04-18T00:00:00Z'
status: dead
superseded_by: calcifer-da67.1.1
depends_on:
- calcifer-da67.3
---

container-runner.ts hardcodes 10 specific env var names (SEAFILE_TOKEN, WORKFLOWY_API_KEY, etc.) — entirely our addition, not upstream. Replace with: read all vars from the applicable .env file (group-specific first, global fallback), pass all of them to the container. Benefits: adding a new tool never requires touching container-runner again; per-group credential isolation works automatically via groups/{folder}/.env; aligns closer to what upstream feature skill branches do. Blocked by da67.3 (if OneCLI handles everything, this block is removed entirely).
