---
id: calcifer-7c3a.8
title: 'Web UI: enhanced running-state signal for multi-message turns'
type: idea
priority: 3
created: '2026-06-13T12:00:00Z'
updated: '2026-06-13T12:00:00Z'
---

PARENT YAK: calcifer-7c3a

The slice's `isRunning` is deliberately simple: true on send, false when an
assistant message arrives. nanoclaw is turn-fuzzy — an agent may send 0/1/N
messages per user turn, or push unprompted — so this boolean can lag (e.g. clears
after the first of several messages, or never sets for a purely pushed message).

Owner decision #5: keep it simple for now; file this for the "enhanced" path.

## Possible approaches (when worth it)

- Drive `isRunning` from typing/`processing_ack` signals already in the system
  (the typing module fires setTyping on an interval while the container runs).
  The web adapter already forwards a `typing` SSE event; an explicit
  "idle/turn-complete" signal on the outbound side would let the client clear
  precisely instead of guessing.
- A lightweight per-thread "agent busy" flag emitted by the container/host at
  turn boundaries (start/idle), surfaced over SSE.
- Reconcile with delivery's `pauseTypingRefreshAfterDelivery` so the indicator
  doesn't flicker between multiple messages of one turn.

Low priority; revisit if the simple heuristic proves annoying in practice.
