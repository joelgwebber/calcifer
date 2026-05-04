---
id: calcifer-ba31
title: WhatsApp channel via Calcifer phone
type: feature
priority: 2
created: '2026-04-23T05:01:11Z'
updated: '2026-04-24T15:34:32Z'
---

Resurrect WhatsApp using the new account on the Calcifer Pixel 7 Pro (US Mobile eSIM, +13292356788). Run /add-whatsapp skill to install the channel, register joel and alicia groups, and verify end-to-end messaging.

---
▸ 2026-04-23T23:43:20Z
Channel connects and sends OK. Inbound broken: fetchProps init query times out (rate-limited after many reconnects during Discord debug). Re-linked Chrome companion device but WhatsApp showed 'Unable to link device — try again later'. Root cause: rate limit on pairing attempts. Fix: wait a few hours, then run: npx tsx src/whatsapp-auth.ts --pairing-code --phone +13292356788 and re-link on Calcifer phone. Also fixed service crash-loop: WhatsApp auth failure now rejects connect() gracefully instead of calling process.exit(1).
