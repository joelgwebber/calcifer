---
id: calcifer-2e0a.6
title: Project agent HTTP serve mode
type: feature
priority: 2
created: '2026-04-24T04:24:49Z'
updated: '2026-04-24T15:28:50Z'
---

Allow project agents to serve HTTP traffic from their container so results can be previewed in a browser.

## Design

Two-phase separation: build (one-shot agent) and serve (long-running container).

**Config fields (projects/{name}/config.yaml):**
- serve_cmd: command to run (e.g. 'npm start', 'python -m http.server')
- serve_port: container port to expose

**New IPC tools in ipc-mcp-stdio.ts:**
- serve_project: start a serve container from the existing workspace
- stop_serve: stop the serve container

**Serve container:**
- Mounts same workspace as the build run (data/projects/{projectId}/workspace/)
- No agent-runner — just execs the serve_cmd directly in the project image
- Binds to 127.0.0.1:{hostPort} on the host
- Lives until explicitly stopped (tracked in project_runs or new serve_runs table)

**Routing to browser:**
- Local: localhost:{hostPort}
- Remote: tailscale serve {hostPort} exposes on tailnet — no reverse proxy needed

**Alternative to config-driven serve_cmd:**
- Project agent writes serve.json into workspace after building
- Host reads it to know what command to run and what port to use
- More flexible — agent decides at build time whether it produced something serveable

## Open questions
- Separate DB table for serve runs, or extend project_runs with a 'serving' status?
- Should serve_project auto-rebuild first, or require a prior completed build run?
