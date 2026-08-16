---
id: calcifer-5b6b.2
title: 'Transport: ephemeral status side-channel (session_state -> SSE ''status'')'
type: task
priority: 2
created: '2026-08-16T15:24:40Z'
updated: '2026-08-16T15:24:55Z'
depends_on:
- calcifer-5b6b.1
parent: calcifer-5b6b
---

Host + container plumbing for ephemeral status. NO transcript pollution.

Container (poll-loop.ts): on each structured activity/progress event, write the current label to outbound session_state under a well-known key (e.g. 'activity_status' = JSON {label, ts}); DELETE/clear it on 'result' (turn done). Reuse container/agent-runner/src/db/session-state.ts.

Host: the delivery active poll (src/delivery.ts, ~1s, already opens outbound.db read-only) reads the session_state status key alongside messages_out and, on change, broadcasts a new SSE event 'status' {threadId, label} via the web adapter. Add a setStatus/broadcast path in src/channels/web.ts (mirror setTyping). Reconcile with the typing module so status and typing don't fight (status supersedes the bare typing dot when present; clear status on turn end).

Decision to confirm with owner: session_state KV (recommended, piggybacks existing 1s poll, ephemeral by overwrite/delete) vs enriching the heartbeat file with a status line (stays in the typing path but 4s granularity is too coarse) vs an ephemeral messages_out type (ordered but risks transcript pollution). Recommendation: session_state KV.
