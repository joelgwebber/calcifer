---
id: calcifer-2e0a.3
title: Project container runner
type: feature
priority: 2
created: '2026-04-23T18:43:21Z'
updated: '2026-04-24T00:10:25Z'
---

New container mount profile and image matrix for background project agents.

MOUNT PROFILE:
  /workspace/task/     — named Docker volume (persists across restarts) with git clone of target repo
  /workspace/context/  — injected task manifest + CLAUDE.md supplement (read-only)
  /workspace/ipc/      — per-task IPC namespace (same pattern as group IPC)

CONTAINER IMAGES (new matrix):
  python: python 3.11+, uv, git, yak CLI, ask_human MCP server, gh CLI
  node:   node 20+, npm, git, yak CLI, ask_human MCP server, gh CLI
  (base already has claude CLI)

STARTUP SEQUENCE:
  1. git clone {repo} /workspace/task (with configured flags/depth)
  2. Start claude CLI: claude -p '{task_prompt}' --dangerously-skip-permissions
  3. .mcp.json in /workspace/task picked up automatically for project-specific MCP tools

PERSISTENCE: Named Docker volume per project task survives container restart.
On resume, agent sees current git state and checkpoint notes, continues naturally.

UPSTREAM: Part of the add-project-agent skill.
