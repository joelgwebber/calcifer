---
id: calcifer-2279
title: Reply routing from correspondent threads (a2a return path)
type: feature
priority: 2
created: '2026-09-02T03:32:08Z'
updated: '2026-09-02T03:32:08Z'
parent: calcifer-dc2b
depends_on:
- calcifer-bd2f
labels:
- agent-to-agent
---

A reply typed in a correspondent thread is a normal web inbound to the recipient's own agent group; the thread's peer_ref context tells her Calcifer to relay it back to the peer via the a2a return path (source_session_id / peer-affinity). Close the loop so a family relay becomes a real back-and-forth in a single standing per-correspondent thread, not a dead-end notification. Depends on the correspondent tag (bd2f) supplying peer_kind/peer_ref.
