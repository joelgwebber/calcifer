---
id: calcifer-678d
title: 'Shared deep links: preserve redirect target through the login gate'
type: idea
priority: 3
created: '2026-08-16T19:12:27Z'
updated: '2026-08-16T19:25:57Z'
parent: calcifer-7c3a
labels:
- auth
---

A relative app deep link (/app/<view>/<id>) absolutizes when a browser copies it, so it's shareable. But a family member without the session cookie who opens a shared link hits the funnel login gate (7c3a.6). Confirm the login flow captures the originally-requested path and redirects back to it after auth, so shared links land on the intended record rather than dumping the user at the app root. Needed for the 'share with family' story once people start passing app links around. Check web-auth.ts / the login redirect handling.

---
▸ 2026-08-16T19:25:57Z
FINDING (investigating 7c3a.9 custom-domain work): deep links already survive the login gate today. web.ts:580 has an SPA history fallback (unknown non-/api paths serve index.html), and login is CLIENT-SIDE + path-preserving (web/src/ui/Login.tsx onSuccess just flips React auth state; App.tsx renders <Login> in place while anon without navigating). So a logged-out user opening /app/<view>/<id>: index.html boots the app at that path -> anon -> Login (URL unchanged) -> success -> Router matches /app/:view/:id -> ViewDetail. No server redirect to lose the path. => 678d is largely VERIFY-only (add a click-test / maybe a small e2e), not a fix. Because auth is client-side and links are relative, this is also domain-agnostic — a custom domain (7c3a.9) doesn't change it.
