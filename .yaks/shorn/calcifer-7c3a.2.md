---
id: calcifer-7c3a.2
title: 'Web UI: thread history load (merge inbound.db + outbound.db)'
type: task
priority: 2
created: '2026-06-13T12:00:00Z'
updated: '2026-07-04T18:18:51Z'
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

---
▸ 2026-07-04T18:18:49Z
DONE + verified end-to-end. Host: new src/channels/web-history.ts with loadThreadHistory(platformId,threadId) (resolves web mg -> findSession -> opens inbound.db+outbound.db READ-ONLY, maps messages_in kind chat->user & messages_out kind chat->assistant, merges by timestamp) and listThreads(platformId) (getActiveSessionsByMessagingGroup, titled from first user msg, newest-first). Added getActiveSessionsByMessagingGroup to db/sessions.ts. Wired GET /api/history and GET /api/threads into web.ts. Key correctness fix: inbound timestamps are ISO-8601 (…T…Z) but outbound uses SQLite datetime('now') ('YYYY-MM-DD HH:MM:SS', UTC, no zone) — normalized to epoch-UTC (toEpoch) before merge, else Date.parse reads outbound as LOCAL and scrambles order; validated the interleave is correct. Client: store gains hydrated map + hydrateThreadList + setThreadMessages, and appendMessage now dedupes by id (guards history/SSE race). runtime.tsx hydrates thread list on connect, loads current thread's history, and lazy-loads on onSwitchToThread; empty-history guard avoids wiping optimistic/live msgs. Segregation verified (each thread's history from its own session DBs only). Verified in browser via chrome-devtools: reload restores all 6 threads + current transcript (was: single empty thread before); switching a thread lazy-loads its history; sending in a RESTORED thread appends live reply with no clobber/dupe and reuses the existing session. Host rebuilt (tsc) + systemd service restarted to serve new endpoints. Both host + web typecheck/build green.
