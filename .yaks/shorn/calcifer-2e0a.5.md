---
id: calcifer-2e0a.5
title: GitHub PR integration for project agents
type: feature
priority: 3
created: '2026-04-23T18:43:22Z'
updated: '2026-04-25T01:02:48Z'
---

Project agents can open GitHub PRs on completion via gh CLI.

BEHAVIOR:
  On task completion, agent:
  1. git push origin {branch}
  2. gh pr create --title '{yak title}' --body '{yak description + session notes}'
  3. Sends PR URL to user via Calcifer

CONTAINER REQUIREMENT: gh CLI pre-authenticated (via OneCLI credential injection or .env token)

CONFIG: Optional per project — some projects may just want a branch, not a PR.
  config.yaml: open_pr: true|false (default false)

UPSTREAM: Part of the add-project-agent skill.
