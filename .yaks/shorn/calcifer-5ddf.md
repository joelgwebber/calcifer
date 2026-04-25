---
id: calcifer-5ddf
title: 'Wiki: scheduled Seafile source-change detection'
type: feature
priority: 3
created: '2026-04-17T23:45:32Z'
updated: '2026-04-18T01:09:26Z'
depends_on:
- calcifer-18a7
labels:
- wiki
commit: 1ef15b1
---

A weekly scheduled task that scans known Seafile source paths (notes/, health/, real-estate/, cars/, family/, etc.), compares file mtimes against the last-ingest timestamps recorded in wiki/log.md, and sends a notification listing files that have changed since their last ingest.

This allows the wiki to stay current with Obsidian edits without Joel having to manually tell the agent about every change.

Depends on: Seafile MCP mtime exposure yak (list_dir must return mtimes for this to work).
