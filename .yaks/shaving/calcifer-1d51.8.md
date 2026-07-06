---
id: calcifer-1d51.8
title: Family-shared skill data (scope=shared) + relocate nyc-apt to a shared mount
type: task
priority: 2
created: '2026-07-06T21:10:57Z'
updated: '2026-07-06T21:10:57Z'
depends_on:
- calcifer-1d51.3
- calcifer-1d51.5
labels:
- skill-views
- nyc-apt
---

Make a skill's data + DB family-wide instead of per-agent. Architecture: shared skill data lives in a host shared root (config SHARED_DATA_DIR = store/shared), mounted RW into every family agent container at a common path (shared/<skill>, same pattern as family-wiki); exactly ONE agent runs the monitor (single-writer); the web data plane reads scope=shared sources from SHARED_DATA_DIR regardless of the viewing user's agent group. Annotations are already family-shared. MECHANISM (done, low-risk): manifest data.scope 'agent'(default)|'shared'; data-plane resolves shared paths against SHARED_DATA_DIR; SHARED_DATA_DIR added to config. RELOCATION (pending owner OK + shared-location decision): (1) pick shared location — recommend calcifer-local store/shared/nyc-apt, NOT Seafile (live sqlite + Seafile sync = corruption risk); (2) copy groups/dm-with-joel/nyc-apt (listings.db + node_modules) -> store/shared/nyc-apt; (3) add mount store/shared/nyc-apt -> container shared/nyc-apt to each family agent's container.json (dm-with-joel, dm-with-alicia, +future); (4) repoint the nyc-apt monitor schedule's NYC_APT_DIR to /workspace/extra/shared/nyc-apt (single writer stays in one agent); (5) set apartments view.json data.scope=shared + data.path=nyc-apt/listings.db; (6) provision family web users (web:alicia -> dm-with-alicia, etc.). Touches the live monitor + needs family container restarts, so confirm before executing.
