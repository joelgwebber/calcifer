---
id: calcifer-5b6b.4
title: 'Precise turn-boundary signal: accurate isRunning for multi-message + pushed
  turns'
type: task
priority: 3
created: '2026-08-16T15:24:40Z'
updated: '2026-08-16T18:36:43Z'
depends_on:
- calcifer-5b6b.2
parent: calcifer-5b6b
---

The ORIGINAL 7c3a.8 concern. Today isRunning is a heuristic: true on 'typing', false on first 'message'. nanoclaw is turn-fuzzy (0/1/N messages per turn; unprompted pushes), so it clears after the first of several messages, or never sets for a purely pushed message.

With the status side-channel in place, emit an explicit turn-start / turn-idle signal at the container turn boundary (poll-loop already knows: query start -> busy; 'result' -> idle). Surface an 'idle' status (or a running:false in the status payload) so the frontend clears precisely on turn-complete rather than on first message, and can show running for a purely-pushed turn. Reconcile with delivery's pauseTypingRefreshAfterDelivery so the indicator doesn't flicker between multiple messages of one turn.

Depends on the transport child.

---
▸ 2026-08-16T18:36:43Z
Done + verified. Made the activity-status channel a reliable turn-active ENVELOPE: poll-loop writes a generic 'Working…' label at turn start (before provider.query), real labels overwrite it, and processQuery's finally clears it at turn end (even on error). Frontend now derives running precisely from the envelope: status non-null -> running true; status null -> running FALSE (authoritative turn-end); a delivered message only clears running as a safety net when no label is active (so 0/1/N-message and no-reply/pushed turns no longer clear early or stick). typing remains a cold-start primer. Verified via SSE probe: envelope emitted 'Working…' -> 'Running tool search' -> 'Searching the web: "…"' -> 'Responding…' -> null, 1 message. Container typecheck + web build clean. Residual edge (accepted): a container that sets typing then fails to spawn at all never opens an envelope; rare cold-start-failure surface, no reply either way.
