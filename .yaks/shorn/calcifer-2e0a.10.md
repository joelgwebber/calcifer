---
id: calcifer-2e0a.10
title: Collapse project workspace to per-name, share across runs
type: feature
priority: 2
created: '2026-04-24T17:12:31Z'
updated: '2026-04-24T17:18:38Z'
parent: calcifer-2e0a
---

Each start_project currently creates a new timestamped directory (data/projects/{name}-{timestamp}/), giving every run an isolated clone. This makes iterative follow-up work impossible — the agent starts fresh each time with no knowledge of what the previous run built.

Collapse workspace, ipc, sessions, and context dirs to data/projects/{name}/ (shared across all runs of the same project). The project_runs table keeps timestamped run IDs for history and status tracking. Logs move to data/projects/{name}/logs/ (shared) or runs/{id}/logs/ (per-run).

Key benefits:
- Follow-up builds see committed work from previous runs
- serve_project always knows where the workspace is without hunting getLatestDoneProjectRun()
- Claude sessions persist across runs of the same project (agent remembers context)
- No risk of concurrent writes: getActiveProjectRun() already enforces one-at-a-time

Parallel branches on the same repo would require named workspaces, which is a separate opt-in design if ever needed. Human context limits make parallel agent management impractical anyway.
