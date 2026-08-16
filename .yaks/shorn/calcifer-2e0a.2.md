---
id: calcifer-2e0a.2
title: Project configuration system
type: feature
priority: 2
created: '2026-04-23T18:43:21Z'
updated: '2026-04-23T23:58:15Z'
parent: calcifer-2e0a
---

projects/ directory structure for defining background project agents.

STRUCTURE:
  projects/{name}/config.yaml   — repo URL, runtime (python|node|rust), clone flags, test cmd
  projects/{name}/CLAUDE.md     — Calcifer supplement (ask_human usage, push conventions, yaks workflow)

config.yaml schema:
  name: gnusto
  repo: https://github.com/rocketsurgery-games/gnusto.git
  default_branch: main
  runtime: python
  clone_flags: --recursive
  submodule_depth: 1
  test_cmd: uv run pytest tests/

BEHAVIOR:
- Calcifer discovers projects by scanning projects/*/config.yaml at startup
- Project CLAUDE.md from cloned repo is injected alongside the Calcifer supplement
- .mcp.json and .claude/ in project repo are picked up automatically by claude CLI (path-based discovery)

UPSTREAM: Part of the add-project-agent skill.
