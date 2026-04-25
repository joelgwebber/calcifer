---
id: calcifer-d199.2
title: 'Bootstrap v2 entity model: /init-first-agent for joel + alicia'
type: task
priority: 1
created: '2026-04-25T18:05:28Z'
updated: '2026-04-25T18:27:26Z'
---

Create users, agent_groups, messaging_groups in the v2 DB. v2 retired the 'main=admin' concept — joel becomes admin via user_roles.

Steps:
- Run /init-first-agent to bootstrap joel's DM-wired agent
- Add alicia's agent group
- Wire existing WhatsApp/Telegram/Discord/emacs/SMS groups via /manage-channels
- Assign joel as owner/admin in user_roles
- Populate groups/joel/ and groups/alicia/ with container.json + CLAUDE.local.md from migration

### 2026-04-25T18:27:26Z
Joel's agent bootstrapped: ag-1777141351652-tx7j2h @ groups/dm-with-joel. Telegram DM wired (platform_id: telegram:8716844131). Joel is global owner. container.json has seafile, readeck, workflowy, fastmail, simple-memory MCP servers + features=[projects]. Welcome DM confirmed delivered. Alicia's agent pending — needs her to DM the bot from her Telegram account.
