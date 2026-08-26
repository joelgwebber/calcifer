---
id: calcifer-7e1f
title: 'Future: hosted, sharable artifacts with multi-file support (design constraint)'
type: idea
priority: 4
created: '2026-08-23T23:11:20Z'
updated: '2026-08-26T00:48:23Z'
labels:
- web-ui
---

Not for implementation now — a forward-looking constraint to keep the overhaul from painting us into a corner. Goal: Claude-artifacts-style hosted, sharable output, but with better handling of MULTIPLE files (a file tree within one artifact, not a single blob). Design touchpoints for this pass: (1) A-spine layout should leave room for a right-hand split-pane / third region beyond the thread (Claude opens artifacts there); (2) B0 schema reserves folder_id/project_id so artifacts can associate with threads/projects; (3) relates to the existing skill-views system (d720) and prior 'output artifact hosting' notes — the artifact host may build on views + a byte/share endpoint. Revisit as its own herd later.
