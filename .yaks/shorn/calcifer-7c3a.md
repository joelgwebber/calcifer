---
id: calcifer-7c3a
title: Web/mobile UI for nanoclaw via assistant-ui
type: feature
priority: 2
created: '2026-06-13T12:00:00Z'
updated: '2026-08-17T18:43:47Z'
---

A structured web (and later mobile) UI for nanoclaw: multiple concurrent
conversations, embedded media, built on the **assistant-ui** React library.
Umbrella yak — see children 7c3a.1 … 7c3a.8.

## Why assistant-ui (vs. reusing Matrix/Telegram, or a full chat app)

Reusing an existing rich client (Matrix+Element, Telegram, Slack) gives
multi-conversation + media for free but no agent-specific UX. Full self-hosted
chat apps (LibreChat, Open WebUI, Lobe) expect to *be* the backend and call an
LLM completions API — a hard impedance mismatch with nanoclaw, which is async,
message-passing, and push-capable (the agent sends 0/1/N messages per turn, and
unprompted messages via schedules/approvals). assistant-ui's capability-based
runtimes let us own the state and render pushed messages as store mutations.

## Architecture decision: ExternalStoreRuntime

assistant-ui offers four runtimes. The decisive property is turn-boundary
semantics. LocalRuntime / AI SDK / AssistantTransport all bind the assistant
response to one request's stream lifetime — no natural channel for unprompted,
out-of-band messages. **ExternalStoreRuntime** is the only one where we own a
messages array, `isRunning` is just a boolean we set, and a pushed agent message
is an array mutation. That is exactly nanoclaw's shape. Multi-thread via
`ExternalStoreThreadListAdapter` (synchronous/inline, hydrated from the host).

A web UI is just another **native channel adapter** (`src/channels/web.ts`),
structurally the `cli.ts` pattern over HTTP instead of a Unix socket.

## Mapping (assistant-ui ⇄ nanoclaw)

- thread (sidebar row)        → nanoclaw `threadId` within one messaging_group per user
- `onNew`                     → `config.onInbound(platformId, threadId, msg)`
- pushed assistant message    → `deliver()` → SSE → store append (free-floating)
- `isRunning`                 → typing / send-true, assistant-arrival-false (see 7c3a.8)
- thread list                 → accessible threads, ExternalStoreThreadListAdapter
- history `load`              → merge inbound.db + outbound.db (7c3a.2)
- attachments                 → OutboundFile + AttachmentAdapter + byte endpoint (7c3a.3)
- send_card                   → message parts / generative UI (7c3a.4)
- approvals                   → human-in-the-loop tool UI (7c3a.5) — the headline differentiator
- user identity               → web:<handle> + roles, group implied by login (7c3a.6)

## Decisions locked (owner)

1. Conversation granularity: threadId-per-conversation, `session_mode=per-thread`.
   Confirmed via session-manager.resolveSession: per-thread keys the session on
   threadId → one thread = one session = one container = isolated context.
2. One user → exactly one agent group, implied by login context. No agent
   switcher in the UI. (Simplifies: no per-conversation routing, no agent picker.)
3. Basic auth is designed-for but deferred (7c3a.6). Slice runs no-auth.
4. Reuse nc-native history/transcripts (7c3a.2); the only hard requirement is
   per-thread context segregation, which the per-thread session model already
   guarantees.
5. `isRunning` kept simple for the slice; richer signal deferred to 7c3a.8.

## Deliberate non-features

assistant-ui branching / edit-and-regenerate / reload assume a replayable,
idempotent model backend. nanoclaw is an append-only side-effecting agent — do
NOT wire `setMessages` / `onEdit` / `onReload`, so those affordances don't appear.

## Repo layout

- Host adapter: `src/channels/web.ts` (built-in http; SSE push + POST inbound; zero new deps).
- Frontend: `web/` (separate package — Vite + React + @assistant-ui/react + zustand;
  NOT in the host pnpm tree, to keep the supply-chain policy untouched).

## Rollout (children)

- 7c3a.1 (slice)  — web adapter + ExternalStore round-trip [SHAVING]
- 7c3a.2          — thread history load (merge in/out DBs)
- 7c3a.3          — attachments / media
- 7c3a.4          — generative UI (send_card)
- 7c3a.5          — approvals as inline tool UI
- 7c3a.6          — basic auth (web:<handle>, group via login)
- 7c3a.7          — mobile (React Native) + verify ExternalStore parity
- 7c3a.8          — enhanced running-state signal
