---
id: calcifer-7c3a.6
title: 'Web UI: basic auth — web:<handle> identity, agent group implied by login'
type: feature
priority: 2
created: '2026-06-13T12:00:00Z'
updated: '2026-06-13T12:00:00Z'
---

PARENT YAK: calcifer-7c3a

The slice runs no-auth (single `web:local` platform_id, public mg). Add basic
auth so the web channel maps a logged-in user to a nanoclaw identity, and — per
owner decision #2 — the agent group is implied by the login context (one user →
one agent group).

## Design

- A login establishes a session/cookie/token mapping the browser to a nanoclaw
  user id `web:<handle>` (mirrors the `<channel>:<handle>` user model).
- platform_id per user (e.g. `web:<handle>`), so each user gets their own
  messaging_group → their own thread set, wired to their one agent group.
  Replaces the fixed `web:local` of the slice.
- `unknown_sender_policy` tightens from `public` to `strict`/`request_approval`.
- SSE/POST/byte endpoints all gate on the auth token; the SSE subscription is
  scoped to the authenticated user's platform_id (no cross-user leakage).
- Wire the user's roles (owner/admin/member) via user_roles so approvals
  (7c3a.5) and command-gating work.

## Open

- Auth mechanism: nanoclaw has no web auth today. Options: a simple shared-secret
  / token issued by the owner, or integrate a real provider later. Start simple
  (owner intent: "prepare for some kind of basic auth").
- How a new web user provisions their messaging_group + wiring (auto on first
  authenticated connect vs. explicit `ncl`/init flow).
- Security review before exposing the port beyond localhost.
