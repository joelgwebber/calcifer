---
id: calcifer-7c3a.6
title: 'Web UI: basic auth — web:<handle> identity, agent group implied by login'
type: feature
priority: 2
created: '2026-06-13T12:00:00Z'
updated: '2026-07-06T18:21:23Z'
parent: calcifer-7c3a
---

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

---
▸ 2026-07-05T13:18:15Z
Auth implemented (zero new deps, Node crypto). Host: migration 016 web_credentials; src/channels/web-auth.ts (scrypt password hash/verify, HMAC-signed session cookie, data/web-auth-secret file, cookie parse/serialize, in-memory per-handle login rate-limit, authenticateRequest); web.ts now gates /api/stream,/api/send,/api/history,/api/threads on resolveUser (cookie->user; falls back to synthetic web:local only when WEB_UI_REQUIRE_AUTH=false), adds POST /api/login, POST /api/logout, GET /api/me. platform_id + senderId are DERIVED from the authed user (never client-supplied) -> per-user isolation, no spoofing. SSE scoped to the user's platform_id. Secure-by-default (WEB_UI_REQUIRE_AUTH!=false); Secure cookie via WEB_UI_SECURE_COOKIE=true for TLS/open-web. scripts/web-user.ts (add/set-password/list/remove) provisions user + credential + per-user messaging group web:<handle> + wiring (per-thread) + role/membership; createMessagingGroupAgent auto-creates the reply destination (normalizeName(mg.name)). Client: api.ts (fetchMe/login/logout), ui/Login.tsx, App.tsx auth-gates (loading/anon/authed) and mounts chat only when authed + Sign-out button; runtime/store drop client platformId (server derives from cookie); styles for login/logout. Provisioned web:joel as owner->The Hearth. VERIFIED via curl end-to-end: bad pw 401, good login sets HttpOnly cookie, /api/me + /api/threads authed, unauth 401 on all data endpoints, send as joel routed to a NEW session under mg web:joel (not web:local) and agent replied 'AUTHED'. Host serves built dist at :8787 (same-origin). Host+web typecheck/build green; migration applied; service restarted with auth on. REMAINING: visual browser click-through of the login screen (chrome-devtools profile locked on Joel's Mac; dev server had died — use http://hearth:8787 directly, no dev server needed). Follow-ups to note: no change-password UI yet (use set-password script); TLS required before exposing publicly (set WEB_UI_SECURE_COOKIE=true).

---
▸ 2026-07-06T18:21:23Z
Owner confirmed the login works end-to-end in the browser ('Login works a charm!'). Visual pass complete. Shearing.
