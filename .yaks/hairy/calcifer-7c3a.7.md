---
id: calcifer-7c3a.7
title: 'Web UI: mobile (React Native) + verify ExternalStore parity'
type: task
priority: 4
created: '2026-06-13T12:00:00Z'
updated: '2026-08-17T18:43:47Z'
labels:
- web-ui
---

PARENT YAK: calcifer-7c3a

assistant-ui ships `@assistant-ui/react-native` (Expo; there's an Expo example
with drawer nav + thread persistence) and `@assistant-ui/react-ink` (terminal),
reusing the same primitives. Same backend design → web + iOS/Android (+ CLI).

## Work

- Reuse the SSE/POST (or upgraded WS) transport + the ExternalStore wiring from
  the web slice in an Expo app.
- VERIFY before committing: the RN package documents its own runtime/adapter
  surface (persistence + title-gen adapters listed separately). Confirm
  `ExternalStoreRuntime` parity on RN via its custom-backend doc rather than
  assuming it's identical to web. If RN diverges, factor the shared transport +
  store into a platform-agnostic module and adapt the runtime per platform.

## Depends on

Slice (7c3a.1) shape stable; ideally after auth (7c3a.6) for real mobile use.
