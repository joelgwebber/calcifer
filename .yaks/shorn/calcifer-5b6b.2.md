---
id: calcifer-5b6b.2
title: 'Transport: ephemeral status side-channel (session_state -> SSE ''status'')'
type: task
priority: 2
created: '2026-08-16T15:24:40Z'
updated: '2026-08-16T16:49:28Z'
depends_on:
- calcifer-5b6b.1
parent: calcifer-5b6b
---

Host + container plumbing for ephemeral status. NO transcript pollution.

Container (poll-loop.ts): on each structured activity/progress event, write the current label to outbound session_state under a well-known key (e.g. 'activity_status' = JSON {label, ts}); DELETE/clear it on 'result' (turn done). Reuse container/agent-runner/src/db/session-state.ts.

Host: the delivery active poll (src/delivery.ts, ~1s, already opens outbound.db read-only) reads the session_state status key alongside messages_out and, on change, broadcasts a new SSE event 'status' {threadId, label} via the web adapter. Add a setStatus/broadcast path in src/channels/web.ts (mirror setTyping). Reconcile with the typing module so status and typing don't fight (status supersedes the bare typing dot when present; clear status on turn end).

Decision to confirm with owner: session_state KV (recommended, piggybacks existing 1s poll, ephemeral by overwrite/delete) vs enriching the heartbeat file with a status line (stays in the typing path but 4s granularity is too coarse) vs an ephemeral messages_out type (ordered but risks transcript pollution). Recommendation: session_state KV.

---
▸ 2026-08-16T16:45:05Z
CORRECTION to prior handoff: container/agent-runner/src is RO bind-mounted from the host at /app/src (src/container-runner.ts:313-315; entrypoint runs 'bun run /app/src/index.ts'). It is NOT baked into the image. So agent-runner source edits go live on the NEXT container spawn — no ./container/build.sh needed for .1/.2. (Only Dockerfile/deps changes need a rebuild; a running container keeps its spawn-time code in memory until it exits/restarts.)

Transport implemented: container writes ephemeral label to outbound session_state key 'activity_status' on each 'progress' event (poll-loop), clears on 'result'/finally/startup; host delivery active-poll (drainSession, ~1s, already iterates all running sessions) reads the key read-only and calls deliveryAdapter.setStatus(channelType, platformId, threadId, label|null) only on change; web adapter broadcasts SSE 'status' {threadId,label}. Added setStatus to ChannelAdapter + ChannelDeliveryAdapter + index.ts multiplexer. Host build + container typecheck + container tests all green. Pending: end-to-end SSE verification after service restart (do with .3).

---
▸ 2026-08-16T16:49:28Z
VERIFIED end-to-end via curl SSE probe against the live host: a web turn that forced tool use produced SSE 'status' events with labels 'Running tool search', 'Searching the web: "..."', then label:null at turn end (3 status, 4 typing, 1 message). Transport confirmed working.
