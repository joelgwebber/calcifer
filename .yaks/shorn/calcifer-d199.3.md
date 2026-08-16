---
id: calcifer-d199.3
title: Re-register all channels in v2 DB
type: task
priority: 2
created: '2026-04-25T18:05:28Z'
updated: '2026-04-25T20:16:22Z'
parent: calcifer-d199
---

Channel registrations live in the v2 central DB (messaging_groups table), not the old registered_groups.json. All existing channels need re-wiring.

Channels to re-register:
- WhatsApp (personal Joel DM + family groups)
- Telegram
- Discord
- Emacs
- SMS-Android

Use /add-whatsapp, /add-telegram, /add-discord, /add-emacs skills + /manage-channels to wire to agent groups. Depends on calcifer-d199.2 (entity model bootstrap).
