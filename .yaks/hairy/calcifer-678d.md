---
id: calcifer-678d
title: 'Shared deep links: preserve redirect target through the login gate'
type: idea
priority: 3
created: '2026-08-16T19:12:27Z'
updated: '2026-08-16T19:12:27Z'
parent: calcifer-7c3a
labels:
- auth
---

A relative app deep link (/app/<view>/<id>) absolutizes when a browser copies it, so it's shareable. But a family member without the session cookie who opens a shared link hits the funnel login gate (7c3a.6). Confirm the login flow captures the originally-requested path and redirects back to it after auth, so shared links land on the intended record rather than dumping the user at the app root. Needed for the 'share with family' story once people start passing app links around. Check web-auth.ts / the login redirect handling.
