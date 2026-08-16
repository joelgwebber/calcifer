---
id: calcifer-da67.6
title: Materialize family group directories and per-group credentials
type: task
priority: 2
created: '2026-04-18T22:49:10Z'
updated: '2026-04-19T03:25:12Z'
depends_on:
- calcifer-da67.1.1
- calcifer-da67.4
commit: 9d10252
parent: calcifer-da67
---

web:joel and web:alicia are registered in the DB but groups/joel-web/ and groups/alicia-web/ don't exist on disk. Run add-family-member for each. Populate groups/{folder}/.env with member-specific credentials once per-group loading is implemented. Verify each member gets isolated context, correct tools, and their own credentials. Register multi-channel JIDs (SMS, Telegram, Discord) all pointing to the same folder per person.
