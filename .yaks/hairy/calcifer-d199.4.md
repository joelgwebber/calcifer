---
id: calcifer-d199.4
title: Modernize project agent IPC to v2 session DB model
type: feature
priority: 3
created: '2026-04-25T18:05:28Z'
updated: '2026-04-25T18:05:28Z'
---

Currently using v1 IPC (stdin JSON + oneShot + stdout markers) for project containers. v2's two-DB session split (inbound.db / outbound.db) is the right model but requires:
- Project containers to write to outbound.db instead of stdout
- Host to read project output from outbound.db instead of stdin
- Retire entrypoint-project.sh in favor of the standard v2 entrypoint

Filed at migration time (previously calcifer-2e0a context). Low priority — current v1 IPC approach still works under v2.
