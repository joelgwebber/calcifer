---
id: calcifer-52d2.11
title: Promote nyc-apt workspace prototype into a version-controlled, generalized
  skill
type: task
priority: 2
created: '2026-06-24T15:55:00Z'
updated: '2026-06-24T15:55:00Z'
parent: calcifer-52d2
---

Calcifer built the working nyc-apt monitor entirely inside its gitignored agent
workspace (`groups/dm-with-joel/nyc-apt/`) and committed only a `SKILL.md` that pointed
at hardcoded `/workspace/agent/nyc-apt/` paths — so the skill shipped as a doc with no
body (uninstallable, not version-controlled).

Promoted the implementation into `container/skills/nyc-apt/` (version-controlled):

- `check.mjs`, `db.mjs` — de-hardcoded: data dir resolved from `$NYC_APT_DIR` (default
  `/workspace/agent/nyc-apt`); deps required from the data dir; `db.mjs` imported
  relatively so it runs from the read-only skill mount.
- Config-driven: StreetEasy area IDs, Stonehenge/Glenwood neighbourhood filters, and
  per-source enable toggles now read from `config.json` (defaults preserve current
  behaviour). Added `config.example.json` + `package.json` (deps manifest).
- Sources behind a `SOURCES` registry; dead `sources/craigslist.mjs` (never imported)
  dropped — Craigslist is inlined.
- `SKILL.md` rewritten: setup, code-vs-data layout, config reference, source-status table,
  "adding a source" guide. Removed the stale hardcoded task ID
  (`task-1782250457366-mmo7z8`; live task is actually `task-1782315421107-cf8hxc`).

Validated: generalized `check.mjs` fetches StreetEasy and emits `wakeAgent:true` with 11
listings against a throwaway data dir. The live workspace copy + 12-min schedule were left
untouched so the running monitor is undisturbed; the schedule can be repointed at
`/app/skills/nyc-apt/check.mjs` once verified in-container.

Generalized the lesson into the `self-customize` skill (new "Growing a New Skill" section
+ self-contained-skill checklist) so future self-built capabilities get promoted out of
the workspace instead of stranded.

Source coverage children .3–.8 remain hairy and accurately reflect reality (Craigslist
IP-blocked; Compass/Corcoran/Elliman SPA/blocked; TransparentCity empty for the 3BR+/$15k
criteria).
