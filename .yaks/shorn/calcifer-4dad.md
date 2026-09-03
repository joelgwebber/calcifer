---
id: calcifer-4dad
title: 'Relay-only turn leaves origin web UI spinning: no reply + stuck running indicator'
type: bug
priority: 2
created: '2026-09-02T04:21:39Z'
updated: '2026-09-03T15:39:35Z'
labels:
- web-ui
---

REPRO (live, 2026-09-02 ~00:05): Joel asks his Calcifer 'send Anaïs this guidance'. His Calcifer's ENTIRE turn output is a <message to="anais"> relay block — delivered mid-turn as the a2a (Joel session sess-1788315458375-4ed8l4 outbound seq53, channel_type=agent), then repeated in the final result and correctly suppressed by the result door ('<message to="anais"> in final result after a same-turn delivery — repeat, result door does not send', poll-loop.ts:1084). So the turn delivers ZERO web-facing messages to Joel. His web chat shows his question with no answer, and the 'thinking'/running indicator never clears → looks 'hung waiting on a response'.

NOT A STUCK PROCESS: the turn completed (processing_ack=completed 04:05:23). The container's .heartbeat froze at turn-end only because touchHeartbeat() is called ONLY inside the active-turn query.events loop (poll-loop.ts:543); the idle loop just sleeps. Idle containers get reaped at the ~30-min absolute ceiling, not via heartbeat. So the 'Up 9 min, frozen heartbeat' is normal idle, not a deadlock.

ROOT (two parts):
1. UI robustness (the concrete bug): the web running indicator is driven by the 'status' side-channel envelope (web/src/runtime.tsx onStatus + onMessage:199 clears running only when a message arrives with no active status). A turn that delivers NO origin-channel message may never close the status envelope on the origin thread → permanent spinner. A turn should ALWAYS signal turn-end to the origin thread even when it produced no web message (e.g. an all-relay turn). Confirm the host emitSessionStatus(null) path fires for such turns.
2. Behavioral (belongs to calcifer-eedc): when relaying, the agent should ALSO post an origin-facing confirmation ('Sent it to Anaïs' — which it DID on the earlier successful attempt, seq37). LLM-nondeterministic; guidance/persona should make the confirmation reliable.

INDEPENDENT of the recipient-routing fix (calcifer-226a): both Joel's and Anaïs's containers show the identical benign result-door pattern; the relay itself worked (Anaïs got the durable 'Joel' thread + surfaced message). Surfaced by the dc2b relay work.

WORKAROUND: refresh the origin UI (running is per-thread client state, re-init false on reload).

---
▸ 2026-09-03T15:39:35Z
SHORN (UI-robustness half). ROOT CAUSE pinned: web running indicator had an asymmetric drive — onTyping set running=true but nothing sends 'typing stopped'; only status=null clears it. The host typing module re-fires setTyping every 4s while the heartbeat is fresh (up to ~6s past turn-end), and pauseTypingRefreshAfterDelivery is SKIPPED for channelType='agent' (a2a) deliveries. So on an all-relay turn: turn ends -> container clears activity_status -> host emits status=null -> running cleared -> then a trailing 'typing' event re-sets running=true -> no further status=null (deduped), no web message -> STUCK. Normal turns escape because a user-facing delivery pauses typing 10s.
FIX (web/src/runtime.tsx): make the status side-channel the SOLE driver of the web running indicator (the 5b6b.4 design intent) — onTyping no longer calls setRunning. Every turn opens a 'Working…' status envelope up front (poll-loop.ts:237) and closes it with a null label at the exact boundary (processQuery finally, even on error), so status is a complete, reliable running signal; typing was redundant and caused the re-strand. onMessage's no-status safety-net clear stays. web built (tsc+vite clean); served from web/dist on reload — no host restart.
Edge left (separate from this bug): a container KILLED mid-turn could leave activity_status set (host keeps emitting the last label); worth a host-side 'emit status=null on session end' safety later. NO-REPLY half (agent should post an origin-facing confirmation when relaying) is behavioral — tracked in calcifer-eedc.
