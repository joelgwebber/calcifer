---
id: calcifer-226a
title: Peer-agent relay to a WEB-only member doesn't surface as a visible chat
type: bug
priority: 1
created: '2026-09-02T02:46:29Z'
updated: '2026-09-02T03:31:41Z'
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
