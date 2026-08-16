---
id: calcifer-5b6b.3
title: 'Frontend: live activity line in the running indicator'
type: task
priority: 2
created: '2026-08-16T15:24:40Z'
updated: '2026-08-16T15:24:55Z'
depends_on:
- calcifer-5b6b.2
---

web/ (Vite; frontend-only, browser reload only).

Consume the new SSE 'status' event in web/src/runtime.tsx; store the current per-thread activity label in the zustand store (web/src/store.ts) alongside the running flag. Render a live activity line in place of / beside assistant-ui's single running dot — e.g. an animated 'working' affordance that shows the current label ('Thinking…', 'Reading listings.db', tool verbs). Clear the label on message/result and when running goes false. Keep it graceful when no label is present (fall back to the current dot).

Depends on the transport child emitting 'status'.
