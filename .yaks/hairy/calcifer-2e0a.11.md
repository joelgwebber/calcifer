---
id: calcifer-2e0a.11
title: 'Project management: create/delete/list projects from Calcifer'
type: feature
priority: 2
created: '2026-04-25T03:39:06Z'
updated: '2026-04-25T03:39:06Z'
---

Add IPC + MCP tools so the main agent can manage projects without host-side intervention.

GAPS:
- No create_project tool: project root is mounted readonly, agent cannot write projects/{name}/config.yaml
- No delete_project tool: no way to remove a project config or clean up its workspace
- No list_projects tool (the projects skill reads config files directly via bash, but an explicit tool would be cleaner)

DESIGN:
- create_project IPC handler: receives name, repo, runtime, default_branch, test_cmd, serve_cmd, serve_port; validates and writes projects/{name}/config.yaml on the host. No restart needed — loadProjectConfigs() is called fresh on each startProjectRun().
- delete_project IPC handler: removes projects/{name}/config.yaml (and optionally data/projects/{name}/workspace). Should refuse if a run is active.
- list_projects IPC handler (optional): returns names + status of all configured projects

MCP tools to add to ipc-mcp-stdio.ts: create_project, delete_project, list_projects

Update container/skills/projects/SKILL.md to document the new tools.
