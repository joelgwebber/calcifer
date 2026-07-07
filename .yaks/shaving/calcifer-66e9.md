---
id: calcifer-66e9
title: 'Retire store/: migrate WhatsApp (Baileys) auth to data/, delete v1 leftovers'
type: task
priority: 2
created: '2026-07-07T20:10:37Z'
updated: '2026-07-07T20:25:21Z'
labels:
- infra
---

store/ can't be nuked wholesale: store/auth + store/pairing-code.txt are the LIVE WhatsApp Baileys session (hardcoded in src/channels/whatsapp.ts:49,237). Plan: copy store/auth -> data/whatsapp-auth; repoint whatsapp.ts AUTH_DIR + pairing-code path to data/; rebuild+restart; verify WhatsApp reconnects with existing creds (no re-pair); then delete store/ (incl v1 leftovers nanoclaw.db (0b), messages.db (v1 history), auth-status.txt). STORE_DIR export in config.ts is dangling (no importers) — remove it too.

---
▸ 2026-07-07T20:25:21Z
BLOCKED (reverted). Repointed whatsapp.ts AUTH_DIR + pairing-code to data/whatsapp-auth, removed dangling STORE_DIR, copied store/auth->data/whatsapp-auth, restarted. WhatsApp then QR-looped with reason=408. Investigation: the 408 closures + QR emission PREDATE the migration restart (persistent since ~22:33 in logs, across earlier restarts) -> the linked-device WhatsApp session is GONE (Baileys only emits QR when creds are unregistered), a pre-existing issue independent of the auth-path change (today's frequent restarts may have stressed it). Rolled back whatsapp.ts + config.ts (git checkout), removed data/whatsapp-auth, restarted onto pristine store/auth. store/ NOT deleted. PLAN: complete this as part of a WhatsApp RE-PAIR — point AUTH_DIR at data/whatsapp-auth first, re-pair (QR/pairing code, needs owner), confirm connected, then delete store/. Until re-paired, leave store/ as-is.
