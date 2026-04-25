---
id: calcifer-fe53
title: Parameterize Seafile library IDs into credentials (private + shared)
type: task
priority: 2
created: '2026-04-19T04:20:23Z'
updated: '2026-04-19T04:21:35Z'
commit: 737c218
---

Move hardcoded Seafile library IDs out of wiki/SKILL.md into per-group credentials. Add env-guard: SEAFILE_WIKI_LIBRARY so wiki skill only appears for groups with a personal wiki. Add SEAFILE_SHARED_LIBRARY for future shared family library.
