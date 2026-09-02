---
id: calcifer-226a
title: Peer-agent relay to a WEB-only member doesn't surface as a visible chat
type: bug
priority: 1
created: '2026-09-02T02:46:29Z'
updated: '2026-09-02T03:51:11Z'
parent: calcifer-dc2b
labels:
- family,web-ui,cross-session-context
---

REPRO: Joel's Calcifer relays to anais (agent dest). Anaïs sees no new chat; her web Calcifer is unaware.

TRACE (all confirmed from session DBs + logs): the a2a hop WORKS — Joel->Anais routed to a new 'agent-shared' session sess-1788316620970-zt0c9d (messaging_group_id=NULL) in Anaïs's group; her Calcifer received Joel's message (inbound seq2 'Joel asked me to pass this along to you (Anaïs)…') and composed a surfacing reply (outbound seq3 'Joel had me pass along some Gmail archiving advice for you:…'), which the host delivered to web:anais at 02:37:08.

WHY IT'S INVISIBLE (two structural reasons):
1. The relay lands in a null-messaging-group a2a session; listThreads only enumerates web:<handle> sessions, so it never appears in her web thread list.
2. The surfacing to her web channel is a LIVE SSE push with no durable web session/thread. She wasn't connected until 02:41 (SSE connect logged), so the 02:37 push was lost; on reconnect there's no thread to show. Her actual web chat (sess-…p207oz, per-thread on web:anais, 'do you have a message for me') is a SEPARATE messaging group from the a2a session, so cross-session-context can't bridge them — her web Calcifer has no knowledge of the relay.

Works for Alicia only because she's on WhatsApp: the surfacing pushes a durable, notified message. Web-only members have no equivalent.

FIX DIRECTION: agent-initiated / pushed messages delivered to a web user must land in a DURABLE, listed web thread (create/attach a web:<handle> session + thread server-side), not just an ephemeral SSE push — so (a) it shows in the thread list and (b) survives offline/refresh. This generalizes beyond the relay to ALL agent-initiated web pushes (reminders, scheduled tasks, approvals landing when the user is away). Relates to the B0/thread-metadata + pushed-message durability work (d483) and the earlier 'gone on refresh' burial (650b). Decide: should the relay surface into a NEW web thread each time, or a persistent 'from Joel' thread?

---
▸ 2026-09-02T03:36:56Z
INVESTIGATION (delivery path traced end-to-end):
- web adapter deliver() (src/channels/web.ts ~L957) ONLY does an ephemeral SSE broadcast — no persistence. Offline/refreshed user loses it; nothing for listThreads to enumerate.
- web UI reads durable history from SESSION DBs (src/channels/web-history.ts): listThreads enumerates per-thread sessions on the web:<handle> messaging group; loadThreadHistory merges inbound.db (user turns, channel_type='web') + outbound.db (assistant turns). An agent-initiated surfaced message is an ASSISTANT turn, so durability requires it in a web per-thread session's outbound.db.
- CONSTRAINT: outbound.db is single-writer = the session's container. Host must not write it (web-history header + two-DB split). The relay surfacing is produced by a NULL-mg 'agent-shared' a2a session (agent-route.ts resolveTargetSession -> resolveSession(..,'agent-shared')), not a web per-thread session, so it can never land in a durable web thread as-is.

FORK (needs owner decision, tilts bd2f/632e):
(i) Host-owned durable push store: new central-DB table for pushed web messages; web-history merges it + synthesizes push-only threads. No container re-run, no outbound.db violation, but a 2nd persistence layer (against web-history's reuse-sessions grain); push threads have no session until the user replies.
(ii) Route the surfacing into a per-thread web session (deterministically keyed peer:<sender-ag-id>) instead of the null-mg agent-shared session, so the recipient's Calcifer RUNS in that web session and its reply is a naturally durable, listed web thread. Zero new persistence; reuses all existing machinery. This is option B from dc2b's KEY FORK + merges with bd2f's keying. Decision #1 (recipient Calcifer chooses channel) already leans B.

Recommend (ii): it's the clean, forward-compatible foundation and avoids a throwaway store. Holding implementation for owner nod on the fork.

---
▸ 2026-09-02T03:51:08Z
SHORN (option ii implemented). Fix: src/modules/agent-to-agent/agent-route.ts resolveTargetSession now, when no return-path/peer-affinity origin resolves (an unsolicited/agent-initiated relay), routes web-backed recipients into a DURABLE per-correspondent web thread instead of the null-mg agent-shared session. New helper resolvePeerWebThreadSession(target, source): finds the recipient's web messaging group (getMessagingGroupsByAgentGroup, channel_type='web', not detached) and resolveSession(target, webMgId, 'peer:<sourceAgentGroupId>', 'per-thread'). The recipient Calcifer then RUNS in that web session, so writeSessionRouting points its reply at web:<handle>/peer:<source>, the turn persists in the session's outbound.db, and listThreads/loadThreadHistory surface it — durable, listed, survives refresh. Deterministic thread_id => repeated relays from the same peer converge on ONE standing thread. Self-messages and single-channel (WhatsApp/SMS) recipients keep the agent-shared path unchanged (verified by existing fallback tests). Test added: 'routes a fresh relay into a durable per-correspondent web thread, not agent-shared' (22/22 route tests + 76 delivery/session/router tests green, build clean). Label/correspondent-tag on the thread is calcifer-bd2f (next).
