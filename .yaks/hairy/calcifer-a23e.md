---
id: calcifer-a23e
title: Complete nanoclaw->calcifer log-name rebrand across setup + skills
type: task
priority: 4
created: '2026-07-07T21:15:30Z'
updated: '2026-07-07T21:15:30Z'
labels:
- infra
- ops
---

This install runs a hand-rolled calcifer.service (logs to logs/calcifer.log|calcifer.error.log), but much of the tracked codebase still says logs/nanoclaw.log. Already fixed the operative docs (CLAUDE.md troubleshooting table + .claude/skills/debug/SKILL.md) and deleted the stale logs/nanoclaw.* files. STILL stale (left alone to avoid churn/upstream-merge conflicts): setup/service.ts (generates systemd unit/launchd plist + nohup fallback pointing at nanoclaw.log; also uses slug-based unit names nanoclaw-v2-<slug> this install doesn't use), setup/service.test.ts, setup/auto.ts, setup/channels/teams.ts, and add-* skills (add-signal, add-gmail-tool, add-gcal-tool, add-wechat, x-integration, add-dashboard, add-atomic-chat-tool, migrate-from-v1). Decide: (a) fully rebrand, or (b) leave upstream-clean and rely on the corrected CLAUDE.md/debug skill. logs/ is gitignored so the log files are local-only.
