---
id: calcifer-1d51.6
title: 'Chat <-> view bridging: card Open-links + ask action'
type: task
priority: 3
created: '2026-07-06T18:21:14Z'
updated: '2026-07-07T22:19:03Z'
depends_on:
- calcifer-7c3a.4
- calcifer-1d51.4
labels:
- skill-views
- web-ui
parent: calcifer-1d51
---

Post-v0. Make inline chat cards (7c3a.4) projections of view records: a card carries an Open affordance deep-linking to /app/<view>/<record_id>. Add the ask action to views: POST /api/send a templated message to the agent (e.g. draft an inquiry for {address}), bridging the direct data plane back to conversational smarts. Acceptance: show-me-today-apartments yields a card that links into the view; an ask action from a listing starts an agent turn in chat.

---
▸ 2026-07-07T22:19:03Z
DONE + verified in browser as web:joel. (1) ASK action: shared web/src/send.ts sendUserMessage (runtime.tsx onNew refactored onto it); web/src/views/AskButton.tsx interpolates the manifest prompt against the row, opens a FRESH thread, fires the send, navigates to chat. Wired into ViewList CardAction + ViewDetail DetailAction. Verified: 'Draft inquiry' on 58 Leroy -> new thread w/ interpolated prompt (address+url filled) -> agent drafted a full inquiry rendered in chat. (2) CARD Open-links: Card.tsx routes actions whose url starts with '/' via react-router Link (in-app SPA nav); external stay target=_blank. Verified: card w/ action url /app/apartments/se-5095099 -> 'View in app' -> in-app nav to the record detail. Deep-link pattern documented in send_card instructions (interactive.instructions.md; reaches the agent on next container build).
