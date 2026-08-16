---
id: calcifer-2e0a.11
title: 'Project management: create/delete/list projects from Calcifer'
type: feature
priority: 2
created: '2026-04-25T03:39:06Z'
updated: '2026-05-04T02:12:02Z'
parent: calcifer-2e0a
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

---
▸ 2026-04-27T00:03:18Z
OneCLI agent provisioning: new project agents are created in selective mode (no secrets) by default, which causes credential injection to silently fail. Fixed this lazily in project-runner.ts — ensureAgentSecretModeAll() is called on first container spawn whenever ensureAgent() returns created:true. The create_project handler should either (a) accept this lazy approach and document it, or (b) proactively call the same provisioning step at project creation time so the first run doesn't risk a race if the agent isn't in the vault yet.

---
▸ 2026-04-27T02:01:22Z
Root cause of 'Invalid API key' in project containers found: project-runner.ts was explicitly setting ANTHROPIC_API_KEY=placeholder, causing the claude binary to use the x-api-key auth path. The OneCLI 'anthropic' type secret only intercepts Bearer/OAuth tokens (CLAUDE_CODE_OAUTH_TOKEN path), not x-api-key headers. Main Calcifer container works because it only gets CLAUDE_CODE_OAUTH_TOKEN=placeholder (no ANTHROPIC_API_KEY). Fixed by removing ANTHROPIC_API_KEY=placeholder from project-runner.ts. Service rebuilt and restarted. Ready for test run.

---
▸ 2026-04-27T02:46:04Z
Root cause analysis complete. Two issues found:

1. **OneCLI auth fix (done)**: project-runner.ts was setting ANTHROPIC_API_KEY=placeholder which routed auth through x-api-key header — OneCLI 'anthropic' type secret only intercepts Bearer/OAuth path. Removed ANTHROPIC_API_KEY, kept CLAUDE_CODE_OAUTH_TOKEN=placeholder only. gnusto container is now running with real credentials.

2. **Calcifer hallucination + echo (done)**: Calcifer has rich session context about gnusto (13:33 run, 11 min of real codebase exploration). After start_project returns immediately, Calcifer predicts the result rather than waiting. Output format: starts with 'Human: <context timezone=...>' followed by the gnusto notification format — this is the agent hallucinating both the result AND the format it would arrive in (including auto-compact 'Human:' prefix). Fixed: (a) stripHallucinatedEcho() in formatter.ts drops any result text starting with 'Human: <context'; (b) strengthened start_project tool description to explicitly warn against predicting results.

3. **GITHUB_TOKEN missing (not yet fixed)**: project containers can't push to GitHub or create PRs — entrypoint only configures git credentials if GITHUB_TOKEN env var is set. Needs injection in project-runner.ts.

---
▸ 2026-05-04T02:12:02Z
Implementation now depends on 2e0a.13 (worktree manager). Key changes to the original design:

- create_project: after writing config.yaml, must also clone the repo into data/projects/{name}/repo/ (or queue the clone for first use). The old design just wrote a config file.
- delete_project: must prune all active worktrees (git worktree remove) before removing repo/. Must refuse if any yak containers are running against this project.
- list_projects: should include active worktrees/yak containers per project, not just config existence.

The IPC handler signatures are otherwise unchanged. Implement after 2e0a.13.
