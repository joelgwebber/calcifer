---
id: calcifer-5b6b.3
title: 'Frontend: live activity line in the running indicator'
type: task
priority: 2
created: '2026-08-16T15:24:40Z'
updated: '2026-08-16T16:49:28Z'
depends_on:
- calcifer-5b6b.2
parent: calcifer-5b6b
---

web/ (Vite; frontend-only, browser reload only).

Consume the new SSE 'status' event in web/src/runtime.tsx; store the current per-thread activity label in the zustand store (web/src/store.ts) alongside the running flag. Render a live activity line in place of / beside assistant-ui's single running dot — e.g. an animated 'working' affordance that shows the current label ('Thinking…', 'Reading listings.db', tool verbs). Clear the label on message/result and when running goes false. Keep it graceful when no label is present (fall back to the current dot).

Depends on the transport child emitting 'status'.

---
▸ 2026-08-16T16:49:28Z
Done. Store gains per-thread status: Record<string,string|null> + setStatus(); setRunning(false) also clears the label so it can't freeze. runtime.tsx handles the SSE 'status' event (non-null label -> running=true + set label; null -> clear label). Thread.tsx renders <ActivityIndicator/> (store-driven, no unverified assistant-ui primitives) after Messages: animated dots + italic label when running, dots-only when running with no label, nothing when idle. styles.css adds .activity-indicator/.activity-dots with a bounce keyframe + prefers-reduced-motion fallback. Frontend tsc+vite build clean. Transport verified upstream (see .2); user does the visual click-test in the authed browser (chrome-devtools has no creds).
