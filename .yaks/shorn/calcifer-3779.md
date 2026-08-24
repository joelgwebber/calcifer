---
id: calcifer-3779
title: Web UI history renders cross-session-echo rows as user messages
type: bug
priority: 2
created: '2026-08-23T20:35:02Z'
updated: '2026-08-23T20:45:56Z'
labels:
- web
- history
- cross-session-context
- reliability
---

loadThreadHistory (src/channels/web-history.ts) selects messages_in WHERE kind IN ('chat','chat-sdk') and marks EVERY row role:'user'. Cross-session-context echo rows are channel_type='session-echo' but kind='chat', so they pass the filter; backfill copies BOTH user and agent sibling messages, so all render as the user -> 'same ~20 mixed messages, all from me, tacked on every chat'. Confirmed live: a web session had 9 session-echo + 4 web rows in messages_in. NOT delivered (messages_out clean) -> pure web display bug. New since the Aug-22 cross-session-context module; web-history predates it (yak 7c3a). Fix: scope the inbound history + thread-title queries to channel_type='web'. Host code -> restart service to deploy.

---
▸ 2026-08-23T20:36:48Z
Fixed src/channels/web-history.ts: both loadThreadHistory (transcript) and listThreads (thread title) now filter messages_in on channel_type = ? bound to CHANNEL_TYPE ('web'), excluding session-echo context rows and 'agent' on_wake/system rows. Assistant turns still come from outbound.db. tsc --noEmit: 0 errors. Echo rows stay in messages_in as legit agent context (unchanged) -> no data cleanup needed. Host code -> deploy via 'systemctl --user restart calcifer', then reload the web UI to verify the phantom messages are gone. Regrow if any phantom turns persist (would mean a real user turn carries a non-'web' channel_type).

---
▸ 2026-08-23T20:45:56Z
DEPLOYED 2026-08-23: host runs compiled dist (systemd ExecStart=node dist/index.js), so the fix needed 'pnpm run build' BEFORE 'systemctl --user restart calcifer' — a bare restart reran stale dist (that's why the first restart 'did nothing'). Rebuilt dist/channels/web-history.js (both channel_type filters present), service is active. User to hard-reload the web UI to re-fetch /api/history. Corrected the deploy step in CALCIFER.md (host code = build + restart).
