---
id: calcifer-7c3a.1
title: 'Thin vertical slice: web channel adapter + assistant-ui ExternalStore round-trip'
type: task
priority: 1
created: '2026-06-13T12:00:00Z'
updated: '2026-06-13T12:00:00Z'
---

PARENT YAK: calcifer-7c3a

Prove the whole thesis cheaply: text round-trip, multiple conversations, and the
push path (assistant messages arrive out-of-band, not as a request response).
Text only — no attachments, auth, persistence, cards, or approvals.

## Transport contract (host ⇄ browser)

Host serves on `WEB_UI_PORT` (default 8787), built-in http, zero new deps:

- `POST /api/send` `{ platformId, threadId, text }` → `{ ok, id }` → `config.onInbound`.
- `GET /api/stream?platformId=web:local` → SSE. Events: `ready` `{}`,
  `message` `{ threadId, message:{ id, role:"assistant", text, createdAt } }`,
  `typing` `{ threadId }`.
- Any other path → static-serve `web/dist` (SPA fallback) if built.

Client: constant `platformId="web:local"`; `threadId = crypto.randomUUID()` per
conversation. `isRunning` true on send, false when an assistant message arrives.

## One-time wiring (no auth yet)

Replace <AGENT_GROUP_ID> with your agent group (`ncl groups list`):

    ncl messaging-groups create --channel_type web --platform_id web:local \
        --is_group 1 --unknown_sender_policy public
    ncl wirings create --messaging_group_id <MG_ID> --agent_group_id <AGENT_GROUP_ID> \
        --engage_mode pattern --engage_pattern . --session_mode per-thread

engage pattern `.` = respond to every message (DM-like). per-thread = one
session/container per conversation (context segregation).

## Acceptance

- Start host (`pnpm run dev`); web channel logs "Web channel listening".
- `cd web && npm install && npm run dev`; open the Vite URL.
- Send a message → agent reply appears in the same thread.
- "New chat" → second conversation; replies land in the right thread; the two
  do not share context (distinct sessions/containers).
- Refresh resets threads (in-memory store) — acceptable for the slice (7c3a.2).

## Status

▸ 2026-06-13T12:00:00Z
Host adapter `src/channels/web.ts` written (SSE+POST, built-in http, zero deps),
registered in `src/channels/index.ts`. Frontend scaffolded under `web/`
(Vite + React + @assistant-ui/react ExternalStore + zustand). Remaining:
`cd web && npm install`, typecheck/build the frontend, verify assistant-ui
primitive names against installed types (sub-agent flagged a few `// TODO verify`
spots: ThreadPrimitive.Messages/Empty component slot names, ThreadListPrimitive
component slots, ThreadListItemPrimitive.Title fallback prop, onNew return type,
data-active styling), then run the end-to-end wiring above.
