---
id: calcifer-da67.5
title: Extract MCP tool docs from CLAUDE.md into container skills
type: feature
priority: 2
created: '2026-04-18T22:48:46Z'
updated: '2026-04-19T03:24:51Z'
depends_on:
- calcifer-da67.3
commit: 9d10252
parent: calcifer-da67
---

groups/main/CLAUDE.md is 1054 lines because MCP tool usage docs (Seafile, WorkFlowy, Readeck, Fastmail, Substack) are inlined rather than in container/skills/. This bloats every agent's context window and makes per-group tool gating impossible. Extract each tool into a container skill with: SKILL.md usage docs, allowed-tools frontmatter, env-var guard (check for relevant key, bail if absent). Then trim CLAUDE.md to ~100 lines of persona + user facts. Blocked by da67.3 (need to know if OneCLI changes how credentials work before writing skill guards).
