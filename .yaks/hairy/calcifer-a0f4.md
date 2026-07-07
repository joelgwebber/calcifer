---
id: calcifer-a0f4
title: 'nyc-apt: agent manual DB ops must target the shared data dir (+ migrate stray
  manual listings)'
type: bug
priority: 2
created: '2026-07-07T20:10:37Z'
updated: '2026-07-07T20:10:37Z'
labels:
- nyc-apt
- skill-views
---

After the shared relocation (1d51.8), the scheduled monitor writes data/shared/nyc-apt, but the AGENT's manual ops (and its SKILL.md prose) still use the old default /workspace/agent/nyc-apt -> manual adds land in the old DB, invisible in the web view. Repro: owner asked calcifer to add ~8 apts; 6 manual-* rows went to groups/dm-with-joel/nyc-apt/listings.db, not shared. Fix: set NYC_APT_DIR=/workspace/extra/shared/nyc-apt as a container env on the monitor's agent group so ALL invocations default to shared; update SKILL.md prose. Data recovery: migrate the manual-* rows from the old DB into data/shared/nyc-apt/listings.db so they appear. Also: the agent has no knowledge of the web apartments UI (told user 'no UI exists') — consider a CLAUDE fragment noting the shared DB feeds a web view.
