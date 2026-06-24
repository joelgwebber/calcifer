---
id: calcifer-7c3a.2
title: 'Web UI: thread history load (merge inbound.db + outbound.db)'
type: task
priority: 2
created: '2026-06-13T12:00:00Z'
updated: '2026-06-13T12:00:00Z'
---

PARENT YAK: calcifer-7c3a

The slice (7c3a.1) keeps messages in an in-memory store, so a refresh loses the
transcript. Reuse nc-native history rather than inventing a new store (owner
decision #4): on thread open, the host merges the session's `inbound.db`
(messages_in) and `outbound.db` (messages_out) into a single timestamp-ordered
transcript and returns it as ThreadMessageLike[].

## Work

- Host: a `GET /api/history?platformId=&threadId=` endpoint that resolves the
  session for (web mg, threadId), opens both session DBs read-only, merges by
  timestamp, maps to `{ id, role, text, createdAt }` (inbound → user, outbound →
  assistant), returns JSON. Reuse `openInboundDb`/`openOutboundDb` from
  session-manager; do NOT write to outbound.db (single-writer invariant).
- Resolving threadId → session: per-thread session keyed by threadId; if no
  session exists yet (never-opened thread) return empty.
- Client: on `onSwitchToThread`, fetch history and hydrate that thread's array.
- Hydrate the thread LIST on connect too (which conversations exist) — needs a
  host endpoint listing sessions for the web mg (id + last_active + a title).

## Segregation guard

Each thread's history must come ONLY from its own session DBs. Verify a message
sent in thread A never appears in thread B's transcript (distinct sessions).

## Open

- Title source: first user message? a stored title? (assistant-ui generateTitle
  is a RemoteThreadList feature; ExternalStore titles are ours to manage.)
- Session lifecycle vs. durability: sessions persist under data/v2-sessions/, but
  confirm they aren't pruned out from under the UI.
