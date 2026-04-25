---
id: calcifer-18a7
title: 'Seafile MCP: expose mtime in list_dir output'
type: feature
priority: 2
created: '2026-04-17T23:45:30Z'
updated: '2026-04-18T00:40:54Z'
labels:
- wiki
commit: d95c12b
---

The seafile_list_dir MCP tool currently does not return file modification timestamps. This makes it impossible for the wiki agent to detect which source files have changed since last ingest.

Add  (and optionally ) to each file/directory entry in the list_dir response. The Seafile REST API already exposes mtime on directory entries, so this is primarily a matter of surfacing it through the MCP tool.

This is a key dependency for automatic wiki change detection (see related yak for scheduled source-change detection).
