---
id: calcifer-d199.1
title: Run /init-onecli; fold calcifer-249b
type: task
priority: 1
created: '2026-04-25T18:05:27Z'
updated: '2026-04-25T18:18:02Z'
parent: calcifer-d199
---

Install the OneCLI Agent Vault and migrate credentials. Folds calcifer-249b (still shaving).

Steps:
- Run /init-onecli skill
- Migrate Anthropic API key
- Migrate service credentials (Discord, Telegram, WhatsApp, etc.)
- Set secret-mode=all for agent groups (or assign per-agent)
- Verify containers can make API calls
- Shorn calcifer-249b
