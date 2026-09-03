---
id: calcifer-dc2b
title: 'Agent->human delivery: durable, channel-aware, per-correspondent threading'
type: feature
priority: 2
created: '2026-09-02T03:28:54Z'
updated: '2026-09-03T16:27:07Z'
labels:
- web-ui,family,agent-to-agent
---

Design herd for the general primitive: an agent delivers a message to its human over that humans channel. One shared mechanism behind family relays (01fa) AND unbidden notifications (reminders 41ec, scheduled-task output, away-approvals). The agent-to-agent hop already works; the missing 80 percent is durable, channel-aware delivery + threading + reply routing. First symptom: 226a (web relay invisible).

MODEL - a thread has a correspondent:
- Single-thread channels (WhatsApp/SMS/Telegram/Signal): one DM; every correspondent (peer relay, reminder, own chat) collapses into it, distinguished by provenance in the text. Already works: the recipients channel wired agent-shared makes the a2a session equal the DM.
- Multi-thread channels (web/native): default a per-correspondent standing thread - a Joel thread for relays from Joel, a Reminders/Calcifer thread for own-agent notifications - with an explicit-thread override. A reply in a correspondent thread routes back to that correspondent (peer agent) via the a2a return path; the threads correspondent IS the return path.

DECISIONS (owner):
1. Channel selection is the RECIPIENT CALCIFER call - it knows which channels the user is active on and can learn preferences over time. Not a static primary-channel setting. Favors the two-hop model (recipient agent chooses then surfaces) over hard-routing a relay into a channel.
2. Fidelity: interpretation welcome on BOTH ends (senders context to read intent, receivers context to render usefully) WITH explicit guidance to preserve the FULL intent and semantics of a forwarded message. A persona/framing norm, not a verbatim flag.
3. Delivery receipts (sender learns delivered/surfaced): useful but DEFERRED.
4. Drop risk (recipient agent silently not surfacing): handle via guidance - surface unless a strong reason - and observe.

SKETCH (thread_meta + routing):
- thread_meta gains a correspondent tag: peer_kind (null=user chat | agent | system) + peer_ref (agent_group_id for agent; a label like reminders for system). Drives UI labeling + reply routing.
- Correspondent threads use a deterministic thread_id (peer:sender-ag-id, sys:source) so repeated surfacings from the same source reuse ONE thread, on the recipients channel messaging group web:handle, session_mode per-thread.
- Visibility is nearly free: web-history already filters the transcript to channel_type=web, so the a2a inbound (channel_type=agent) stays context-only and the recipient Calcifers surfacing turn is what shows; listThreads enumerates it because it lives on web:handle.
- Reply routing: a reply typed in a correspondent thread is a normal web inbound to the recipients own agent group; the threads peer_ref context tells her Calcifer to relay back to the peer (a2a return via source_session_id / peer-affinity).
- KEY FORK: (A) route the a2a relay DIRECTLY into the recipients channel thread (simple; bakes channel choice into routing - fine for single-channel recipients, does not honor decision 1 for multi-channel), vs (B) two-hop: a2a lands in the recipients agent, whose Calcifer CHOOSES channel + correspondent thread then surfaces (honors 1; needs richer send-addressing: channel + optional thread). Decision 1 leans B; the durable-thread primitive is needed either way.

SLICES (children): 226a durable web thread (first), correspondent tag + threadId keying + UI label, reply routing from correspondent threads, recipient-Calcifer channel choice, relay fidelity + surface-reliability guidance, (future) delivery receipts.

---
▸ 2026-09-03T16:27:07Z
SHORN (delivered scope). The agent->human durable, channel-aware, per-correspondent delivery path is built + deployed:
- 226a: agent-initiated relays to web recipients land in a DURABLE per-correspondent web thread (peer:<sender-ag>), listed + survives refresh — not a lost SSE push. (commit 5c697984)
- bd2f: those threads are labeled by WHO they're with ('Joel'/'Reminders'), via a shared peer:/sys: grammar (src/correspondent.ts). (6a5e559b)
- 2279: a reply typed in a correspondent thread reliably relays back to the peer — deterministic correspondent note in the recipient's system prompt + the existing a2a return path. (cb53205e)
- eedc: always-on relay conduct in all four family personas — confirm-to-origin after relaying (decisions/4dad), preserve full intent (#2), surface reliably (#4). (76d18922)
Also surfaced + fixed two adjacent bugs while here: 4dad (relay-only turn stranded the web running indicator — status is now the sole driver, 694a28bd) and a9d9 (fastmail compose_event silent no-op — consolidated on fastmail-native, 5c8a697d).
DEFERRED to root (owner-scoped as later work): 632e (recipient-Calcifer channel choice — only needed for multi-channel recipients) and 7175 (delivery receipts, p4). Also open: d254 (mid-turn-kill running-indicator edge), 18ad (no yaks CLI in containers).
