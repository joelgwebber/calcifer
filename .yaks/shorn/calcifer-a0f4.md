---
id: calcifer-a0f4
title: 'nyc-apt: agent manual DB ops must target the shared data dir (+ migrate stray
  manual listings)'
type: bug
priority: 2
created: '2026-07-07T20:10:37Z'
updated: '2026-07-07T20:18:23Z'
labels:
- nyc-apt
- skill-views
---

After the shared relocation (1d51.8), the scheduled monitor writes data/shared/nyc-apt, but the AGENT's manual ops (and its SKILL.md prose) still use the old default /workspace/agent/nyc-apt -> manual adds land in the old DB, invisible in the web view. Repro: owner asked calcifer to add ~8 apts; 6 manual-* rows went to groups/dm-with-joel/nyc-apt/listings.db, not shared. Fix: set NYC_APT_DIR=/workspace/extra/shared/nyc-apt as a container env on the monitor's agent group so ALL invocations default to shared; update SKILL.md prose. Data recovery: migrate the manual-* rows from the old DB into data/shared/nyc-apt/listings.db so they appear. Also: the agent has no knowledge of the web apartments UI (told user 'no UI exists') — consider a CLAUDE fragment noting the shared DB feeds a web view.

---
▸ 2026-07-07T20:18:22Z
Coherence fixed. Root cause: post-relocation, the scheduled monitor writes the shared DB but the AGENT's manual ops used the old default /workspace/agent/nyc-apt (no per-agent-group container env field exists to force NYC_APT_DIR). Fix: (1) per-group memory note in groups/dm-with-joel/CLAUDE.local.md instructing the agent to always use NYC_APT_DIR=/workspace/extra/shared/nyc-apt for nyc-apt commands/manual edits, noting the shared DB feeds the web Apartments view; (2) documented the family-shared pattern in the version-controlled SKILL.md. Data: of the ~10 manual rows the agent added to the OLD db, the 2 complete ones (83 Warren #4/#5, with price/beds) are ALREADY in shared and show in the view (verified via /api/views search). The other 8 are address-only stubs (no price/beds) in the old db only; did NOT host-write the shared db to migrate them (monitor container was running — single-writer discipline). Recommend re-adding those fresh via the now-corrected path (the CLAUDE.local.md note makes the agent target shared). Old groups/dm-with-joel/nyc-apt left inert.
