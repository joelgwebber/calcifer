---
id: calcifer-da67.7
title: Per-group container skill gating mechanism
type: feature
priority: 2
created: '2026-04-18T22:49:10Z'
updated: '2026-04-19T03:24:51Z'
depends_on:
- calcifer-da67.4
- calcifer-da67.5
commit: 9d10252
parent: calcifer-da67
---

Currently all container/skills/ are synced to every group container. For family groups, we want per-person tool access (e.g. Joel has Fastmail, Alicia has her own). Two options: (A) env-var guard in each skill (already part of da67.5 work — skill checks for its key and exits if absent); (B) modify container-runner to filter skills based on a groups/{folder}/skills.yaml or similar. Option A is lower friction and may be sufficient; evaluate after da67.5 is done before committing to B.
