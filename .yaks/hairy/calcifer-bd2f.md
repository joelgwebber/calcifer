---
id: calcifer-bd2f
title: Correspondent tag + deterministic threadId keying + UI label
type: task
priority: 2
created: '2026-09-02T03:31:50Z'
updated: '2026-09-02T03:31:50Z'
parent: calcifer-dc2b
depends_on:
- calcifer-226a
labels:
- web-ui
---

Add a correspondent tag to thread_meta: peer_kind (null=user chat | agent | system) + peer_ref (agent_group_id for an agent peer; a label like 'reminders' for system sources). Key correspondent threads by a deterministic thread_id (peer:<sender-ag-id>, sys:<source>) so repeated surfacings from the same source reuse ONE standing thread on the recipient's web:<handle> messaging group (session_mode per-thread). Surface the correspondent in the web thread list label ('Joel', 'Reminders'). Foundation for reply routing (which reads peer_ref) and channel choice. Builds on 226a's durable web thread.
