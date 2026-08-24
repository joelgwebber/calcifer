---
id: calcifer-7c3a.1
title: 'Thin vertical slice: web channel adapter + assistant-ui ExternalStore round-trip'
type: task
priority: 1
created: '2026-06-13T12:00:00Z'
updated: '2026-07-04T18:11:45Z'
parent: calcifer-7c3a
---

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

---
▸ 2026-07-04T17:45:40Z
Resumed after hiatus. Verified crypto/uuid fix in place (web/src/uuid.ts) and frontend npm-installed. Fixed the one real frontend typecheck error against @assistant-ui/react@0.11.58: ExternalStoreThreadData wants 'id' not 'threadId' (runtime.tsx threadList mapping). Full 'npm run build' now green (tsc + vite, 570 modules). All previously-flagged assistant-ui primitive names verified VALID by the clean typecheck (ThreadPrimitive.Messages/Empty, MessagePrimitive.Parts, ComposerPrimitive.*, ThreadListPrimitive.{Root,New,Items}, ThreadListItemPrimitive.{Root,Trigger,Title fallback}); removed the stale // TODO verify comments. Host live under systemd (calcifer.service), web channel listening on :8787, messaging group web:local wired to agent group 'The Hearth' (ag-1779841737002-18051a) with session_mode=per-thread, engage_pattern '.'. ROOT-CAUSE FOUND + FIXED: inbound path worked (msg reached container, agent produced output) but delivery failed with 'No configured destinations' — The Hearth had no agent_destinations row for the web channel, so the agent had no <message to=...> target. Added destination: local_name='web', target_type='channel', target_id=<web:local mg id>. Full round-trip now VERIFIED end-to-end via terminal (curl SSE + POST, no browser needed): destinations projected into session inbound.db (web|web|web:local), agent reply written to messages_out with correct channel_type/platform_id/thread_id, and assistant message delivered over SSE with the exact contract runtime.tsx parses (ready/typing/message events, correct threadId+role). Remaining: human eyeball of the actual assistant-ui rendering in a browser (chrome-devtools MCP still pinned to Joel's Mac profile / hearth tailnet).

---
▸ 2026-07-04T17:59:38Z
Dev-server tailnet access fix. Nothing was actually on :5173 (no port conflict); raw 'vite --host 0.0.0.0' binds fine. Real issues: (1) 'npm run dev --host 0.0.0.0' needs a '--' separator or the flag never reaches vite; (2) vite.config allowedHosts was ['localhost','hearth'] so reaching the box by its MagicDNS FQDN (hearth.hamlet-algol.ts.net) tripped Vite 5's host check. Fixed in web/vite.config.ts: added server.host=true (bind all interfaces, no flag needed on headless box) and allowedHosts now includes '.hamlet-algol.ts.net' (leading-dot = domain + all subdomains). Verified: plain 'npm run dev' binds *:5173 incl tailnet IP 100.100.128.96, and a request with Host: hearth.hamlet-algol.ts.net:5173 returns 200 (was 403 before).

---
▸ 2026-07-04T18:07:44Z
VISUAL VERIFICATION COMPLETE via chrome-devtools MCP (Chrome on Joel's Mac, reaching http://hearth:5173 over tailnet). Prior blocker (locked/pinned chrome-profile userDataDir) is gone — browser attached first try. Confirmed live in the real assistant-ui: renders correctly (sidebar/empty-state/composer/Send enable+disable); send -> user bubble + running indicator (isRunning) -> assistant reply arrives over SSE and renders inline ('Calcifer here — message received...'); '+ New chat' creates a fresh thread; second thread got its own 'SECOND' reply; switching back to thread 1 shows only thread 1's transcript => per-thread isolation holds in the UI store. ALL 7c3a.1 acceptance criteria met and eyeballed. Slice functionally complete. Outstanding housekeeping only: unstaged changes in web/ (runtime.tsx id-fix, Thread/ThreadList TODO-comment cleanup, vite.config tailnet host+allowedHosts) plus the new agent_destinations 'web' row on The Hearth; 3 inert probe-* test threads can be cleaned. Ready to shear pending commit/cleanup decision.
