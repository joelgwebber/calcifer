---
id: calcifer-66e9
title: 'Retire store/: migrate WhatsApp (Baileys) auth to data/, delete v1 leftovers'
type: task
priority: 2
created: '2026-07-07T20:10:37Z'
updated: '2026-07-07T20:10:37Z'
labels:
- infra
---

store/ can't be nuked wholesale: store/auth + store/pairing-code.txt are the LIVE WhatsApp Baileys session (hardcoded in src/channels/whatsapp.ts:49,237). Plan: copy store/auth -> data/whatsapp-auth; repoint whatsapp.ts AUTH_DIR + pairing-code path to data/; rebuild+restart; verify WhatsApp reconnects with existing creds (no re-pair); then delete store/ (incl v1 leftovers nanoclaw.db (0b), messages.db (v1 history), auth-status.txt). STORE_DIR export in config.ts is dangling (no importers) — remove it too.
