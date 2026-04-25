---
id: calcifer-7e8f
title: 'Wiki: write pages directly to Seafile for Obsidian sync'
type: feature
priority: 2
created: '2026-04-17T23:45:31Z'
updated: '2026-04-18T01:06:43Z'
labels:
- wiki
commit: 1ef15b1
---

Wiki pages are currently written to /workspace/group/wiki/ (container-local only), making them inaccessible outside the agent. To make the wiki live in Obsidian via Seafile sync, the wiki skill should write pages to a Seafile library using seafile_upload_file.

Implementation:
- Pick target library/path: a wiki/ subfolder in the existing notes Seafile library (which was previously an Obsidian vault)
- Update CLAUDE.md wiki schema to specify the Seafile write path alongside the local path
- Update the wiki skill to dual-write (local + Seafile) or Seafile-primary
- The local /workspace/group/wiki/ path can remain as a fast-access cache for the agent

Once implemented, do an initial push of the existing ~27 wiki pages to Seafile so Joel can open the notes library in Obsidian and see the full wiki immediately.
