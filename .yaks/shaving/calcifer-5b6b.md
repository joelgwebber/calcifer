---
id: calcifer-5b6b
title: 'Web UI: real-time agent activity feedback during turns'
type: feature
priority: 2
created: '2026-06-13T12:00:00Z'
updated: '2026-08-16T15:33:34Z'
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

---
▸ 2026-08-16T15:24:11Z
Promoted from 7c3a.8 to its own herd. Investigation of the current pipeline (this session):

CURRENT FEEDBACK PIPELINE (end to end):
  Claude SDK (rich: assistant msgs with tool_use/thinking/text blocks, system events)
   -> claude.ts translateEvents() COLLAPSES everything mid-turn to a bare {type:'activity'} liveness ping; only init/result/error and task_notification->progress are structured. Tool names + thinking are discarded here.
   -> poll-loop.ts: every event -> touchHeartbeat() (file touch); 'progress' -> log() ONLY (dead end, never delivered); 'result' -> dispatch <message> blocks -> messages_out.
   -> heartbeat file mtime -> host typing module (src/modules/typing, 4s interval, heartbeat-gated) -> adapter.setTyping
   -> web adapter setTyping -> SSE 'typing' {threadId}
   -> frontend runtime.tsx: typing->setRunning(true), message->setRunning(false); assistant-ui renders a single bullet dot.

THE GAP: only a binary typing signal reaches the browser. All 'what is it doing' richness is thrown away in claude.ts. Hence the single dot with no detail until the turn finishes.

TRANSPORT NOTES: host reads outbound.db read-only in delivery.ts (messages_out, 1s active poll) and host-sweep.ts (processing_ack + container_state). outbound has a session_state KV table (key/value/updated_at) already used for the chat-sdk continuation. That KV, piggybacked on the existing 1s delivery poll, is the natural ephemeral surface for a status side-channel (avoids polluting messages_out/transcript). ~1s granularity is fine for human 'working' feedback.

Original 7c3a.8 scope (precise idle/turn-complete so isRunning is accurate for multi-message + pushed turns) folds in as a child.
