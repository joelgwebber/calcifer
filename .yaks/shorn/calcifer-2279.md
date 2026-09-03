---
id: calcifer-2279
title: Reply routing from correspondent threads (a2a return path)
type: feature
priority: 2
created: '2026-09-02T03:32:08Z'
updated: '2026-09-03T16:25:49Z'
parent: calcifer-dc2b
depends_on:
- calcifer-bd2f
labels:
- agent-to-agent
---

A reply typed in a correspondent thread is a normal web inbound to the recipient's own agent group; the thread's peer_ref context tells her Calcifer to relay it back to the peer via the a2a return path (source_session_id / peer-affinity). Close the loop so a family relay becomes a real back-and-forth in a single standing per-correspondent thread, not a dead-end notification. Depends on the correspondent tag (bd2f) supplying peer_kind/peer_ref.

---
▸ 2026-09-03T16:25:49Z
SHORN. Reply routing from a correspondent thread now works reliably. Two parts:
- EXISTING a2a return path (resolveTargetSession, agent-route.ts): a <message to=peer> from the recipient routes back to the peer's originating session via in_reply_to->source_session_id, else peer-affinity (most recent a2a from that peer). Already in place.
- NEW deterministic correspondent hint (calcifer-2279): the recipient's Calcifer now KNOWS a peer:<ag> thread relays to a specific peer, instead of inferring from history. container/agent-runner/src/db/session-routing.ts gains getCorrespondentAgentGroupId() (parses peer:<ag> from session_routing.thread_id — mirrors host src/correspondent.ts; runtimes share no code). destinations.ts buildSystemPromptAddendum adds a 'This is a correspondent thread' section when in a peer:<ag> session, resolving the peer agent group id to the matching agent destination's local alias (e.g. joel) and instructing: reply by addressing that peer (<message to=joel>), preserve full intent, confirm to your human. Skips the note for ordinary chats or when no destination matches. Built once at spawn (thread_id is fixed per session).
Tests: 3 new cases in destinations.test.ts (note present for peer thread w/ matching dest; absent for ordinary chat; absent when no matching dest). Container typecheck clean; 26 pass. Bind-mounted source → next peer-thread spawn picks it up.
Scope note: replies thread back to the SENDER's originating session (peer-affinity), so the sender sees the reply in the thread they initiated from — full standing-thread-on-both-sides only happens for unsolicited initiations (226a routing). Fine for reply routing.
