---
id: calcifer-2e0a.14
title: 'Multi-turn IPC: poll loop + Calcifer-to-container message routing'
type: feature
priority: 2
created: '2026-05-04T02:12:33Z'
updated: '2026-05-04T02:12:33Z'
parent: calcifer-2e0a
---

Adds interactive multi-turn behavior to project containers. Depends on 2e0a.13 (per-yak worktrees + container-per-yak refactor).

CHANGES TO container/agent-runner/src/project-index.ts:
  Replace one-shot stdin model with a poll loop:
  - On startup: process initial prompt from /workspace/ipc/input/0000.json (written by host at spawn time)
  - After completing a turn: persist sessionId to /workspace/ipc/state.json
  - Poll /workspace/ipc/input/ for new message files (sorted by name); process each in order; delete after processing
  - On shutdown signal (/workspace/ipc/done): commit any pending work, emit final summary, exit cleanly
  - Idle timeout: exit after N minutes with no new messages (configurable, default 2h)
  - Each turn: sdkQuery with resume: sessionId from state.json (first turn has no resume)

CHANGES TO src/project-runner.ts:
  - Add sendMessageToYakContainer(projectName, yakId, message): writes JSON file to
    data/projects/{name}/ipc/input/{timestamp}-{seq}.json
  - Spawn path: write initial prompt as input/0000.json, then spawn detached container
  - No more stdout marker parsing (container communicates back via outbox or IPC, not stdout)

CHANGES TO src/project-manager.ts:
  - startProjectRun when container already running: call sendMessageToYakContainer instead of spawning
  - abandonProjectRun: write done signal to ipc/done before stopping container

CHANGES TO src/project-actions.ts:
  - start_project tool: if getActiveYakRun returns a running container, route as follow-up message
  - Outbound notifications from container (progress updates): container writes to /workspace/ipc/outbox/;
    host sweep picks them up and routes to initiating JID via notifyAgent

PROGRESS UPDATES (subsumes 2e0a.12):
  - Container writes progress files to /workspace/ipc/outbox/{timestamp}.json
  - Host sweep (or a dedicated watcher) picks these up and delivers to the initiating JID
  - No fixed interval — agent writes progress whenever it has something meaningful to report
  - Calcifer can instruct agent via follow-up message to change update frequency

SESSION EXPIRY:
  - Claude Code sessions eventually compact/expire. If resume fails, container starts a fresh context.
  - Container writes a brief state summary to /home/node/.claude/memory/ after each turn as a fallback.
  - This is best-effort; the git history and worktree state are the load-bearing artifacts.
