---
id: calcifer-bd2f
title: Correspondent tag + deterministic threadId keying + UI label
type: task
priority: 2
created: '2026-09-02T03:31:50Z'
updated: '2026-09-02T04:00:31Z'
parent: calcifer-dc2b
depends_on:
- calcifer-226a
labels:
- web-ui
---

Add a correspondent tag to thread_meta: peer_kind (null=user chat | agent | system) + peer_ref (agent_group_id for an agent peer; a label like 'reminders' for system sources). Key correspondent threads by a deterministic thread_id (peer:<sender-ag-id>, sys:<source>) so repeated surfacings from the same source reuse ONE standing thread on the recipient's web:<handle> messaging group (session_mode per-thread). Surface the correspondent in the web thread list label ('Joel', 'Reminders'). Foundation for reply routing (which reads peer_ref) and channel choice. Builds on 226a's durable web thread.

---
▸ 2026-09-02T04:00:31Z
SHORN. Deterministic keying + correspondent tag + UI label delivered. DESIGN CALL: rather than add peer_kind/peer_ref columns (migration + lazily-written thread_meta row that could fall out of sync with the session), the correspondent is encoded in the thread_id itself (peer:<ag-id> / sys:<source>) as the single source of truth, with a shared grammar helper src/correspondent.ts (PEER_/SYSTEM_THREAD_PREFIX, peerThreadId/systemThreadId constructors, parseCorrespondent parser). 226a's inline 'peer:' refactored to use it. web-history.ts enrichedThreads now titles a correspondent thread via correspondentLabel(): agent peer -> person behind the peer agent group (its web mg platform_id -> users.display_name, e.g. 'Joel'/'Anaïs'; fallback prettified handle, then agent group name); system -> prettified source ('Reminders'). Precedence: explicit rename override > correspondent label > first web message > 'Conversation'. No migration, no frontend change (listThreads already returns title; UI renders titles[id]). 2279 will reuse parseCorrespondent for reply routing. Tests: src/correspondent.test.ts (grammar) + src/channels/web-history.test.ts (peer label, override wins, handle fallback, system label). 31 focused + 184 broad tests green, build clean.
