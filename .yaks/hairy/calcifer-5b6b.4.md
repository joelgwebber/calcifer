---
id: calcifer-5b6b.4
title: 'Precise turn-boundary signal: accurate isRunning for multi-message + pushed
  turns'
type: task
priority: 3
created: '2026-08-16T15:24:40Z'
updated: '2026-08-16T15:24:55Z'
depends_on:
- calcifer-5b6b.2
---

The ORIGINAL 7c3a.8 concern. Today isRunning is a heuristic: true on 'typing', false on first 'message'. nanoclaw is turn-fuzzy (0/1/N messages per turn; unprompted pushes), so it clears after the first of several messages, or never sets for a purely pushed message.

With the status side-channel in place, emit an explicit turn-start / turn-idle signal at the container turn boundary (poll-loop already knows: query start -> busy; 'result' -> idle). Surface an 'idle' status (or a running:false in the status payload) so the frontend clears precisely on turn-complete rather than on first message, and can show running for a purely-pushed turn. Reconcile with delivery's pauseTypingRefreshAfterDelivery so the indicator doesn't flicker between multiple messages of one turn.

Depends on the transport child.
