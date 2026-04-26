---
id: calcifer-d199.4
title: Modernize project agent IPC to v2 session DB model
type: feature
priority: 3
created: '2026-04-25T18:05:28Z'
updated: '2026-04-26T15:34:27Z'
---

Currently using v1 IPC (stdin JSON + oneShot + stdout markers) for project containers. v2's two-DB session split (inbound.db / outbound.db) is the right model but requires:
- Project containers to write to outbound.db instead of stdout
- Host to read project output from outbound.db instead of stdin
- Retire entrypoint-project.sh in favor of the standard v2 entrypoint

Filed at migration time (previously calcifer-2e0a context). Low priority — current v1 IPC approach still works under v2.

### 2026-04-26T15:34:27Z
Investigated root cause: entrypoint-project.sh uses npx tsc + node but v2 agent-runner is Bun-native (bun:sqlite, no tsconfig.json in image). tsc exits code 1 immediately. Error message was blank because tsc output goes to stdout (due to redirect) but failure message only checked stderr. Fixed error message to use (stderr||stdout). Full fix requires either: (a) separate project-mode agent-runner entry point that reads from stdin and uses IPC/DB model, or (b) full v2 session DB model for project agents. The project workspace for hello-world is pre-cloned from before v2 migration, so serve_project still works.
