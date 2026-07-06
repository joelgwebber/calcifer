---
id: calcifer-1d51.4
title: Primitive/render layer + addressable auth-gated routes (web)
type: task
priority: 2
created: '2026-07-06T18:20:31Z'
updated: '2026-07-06T18:20:31Z'
depends_on:
- calcifer-1d51.1
- calcifer-1d51.2
- calcifer-1d51.3
labels:
- skill-views
- web-ui
---

Fixed primitive vocabulary in the web app, manifest-driven (no skill JS). Atoms text/money/datetime/number/bool/badge/image/link/keyvalue; composites list/card/detail/gallery/timeline; filters range/multiselect/toggle/daterange/search; actions star/note (-> /api/annotations) + open (external). Addressable routes: /app/<view> with URL-encoded collection/filter/sort state; /app/<view>/<record_id> detail. Rides session cookie; deep-link -> auth gate -> login-then-return to intended URL. Left-nav Apps from GET /api/views. Acceptance: apartments view browsable/filterable/starrable at a bookmarkable URL; record deep-link works after login.
