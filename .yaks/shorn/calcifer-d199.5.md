---
id: calcifer-d199.5
title: Migrate service credentials from .env to OneCLI vault
type: task
priority: 3
created: '2026-04-25T18:15:09Z'
updated: '2026-04-25T21:18:54Z'
parent: calcifer-d199
---

Move per-service credentials out of .env and into OneCLI Agent Vault so containers never see raw keys. Current candidates (all passed to MCP stdio servers via env vars):
- SEAFILE_TOKEN (files.j15r.com)
- READECK_API_KEY (read.j15r.com)
- WORKFLOWY_API_KEY
- GITHUB_TOKEN (github.com/api.github.com)
- FASTMAIL_APP_PASSWORD (imap.fastmail.com)
- ANNAS_SECRET_KEY
- SUBSTACK_SID / SUBSTACK_LLI
- SUBTEXT_API_KEY

Channel tokens (TELEGRAM_BOT_TOKEN, DISCORD_BOT_TOKEN, SMS_*) stay in .env — used by host process, not containers.

Note: after migrating, the MCP server env {} blocks in container.json will rely on OneCLI injection rather than explicit env vars.
