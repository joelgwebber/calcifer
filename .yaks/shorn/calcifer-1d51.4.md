---
id: calcifer-1d51.4
title: Primitive/render layer + addressable auth-gated routes (web)
type: task
priority: 2
created: '2026-07-06T18:20:31Z'
updated: '2026-07-07T21:38:14Z'
depends_on:
- calcifer-1d51.1
- calcifer-1d51.2
- calcifer-1d51.3
labels:
- skill-views
- web-ui
---

Fixed primitive vocabulary in the web app, manifest-driven (no skill JS). Atoms text/money/datetime/number/bool/badge/image/link/keyvalue; composites list/card/detail/gallery/timeline; filters range/multiselect/toggle/daterange/search; actions star/note (-> /api/annotations) + open (external). Addressable routes: /app/<view> with URL-encoded collection/filter/sort state; /app/<view>/<record_id> detail. Rides session cookie; deep-link -> auth gate -> login-then-return to intended URL. Left-nav Apps from GET /api/views. Acceptance: apartments view browsable/filterable/starrable at a bookmarkable URL; record deep-link works after login.

---
▸ 2026-07-06T18:45:58Z
Render layer built. web/src/views: types.ts, api.ts, primitives.tsx (interpolate + typed FieldValue money/datetime/bool/badge/image/link/text/number), Filters.tsx (range/daterange/multiselect-from-facets/toggle), ViewList.tsx (collection tabs + search + sort + filters + cards[star+open] + pagination, URL-synced via useSearchParams), ViewDetail.tsx (field table + timeline + star/open). App.tsx: react-router-dom added; BrowserRouter; auth gate preserved (login-then-return via same URL); nav rail (Chat + Apps from /api/views + sign-out); routes / (chat), /app/:view (list), /app/:view/:id (detail); RuntimeProvider hoisted to shell so SSE stays open across nav. Build green (tsc+vite, 580 modules). ask/navigate actions deferred to .6. Visual click-through pending owner (chrome-devtools profile locked; owner rotated password so I cannot log in as joel).

---
▸ 2026-07-07T21:38:14Z
Visual click-through VERIFIED via chrome-devtools as authed web:joel at hearth:8787/app/apartments (nav rail shows 'Signed in as Joel'). Render layer: cards (address/beds/neighborhood/source badge/price/star/open) + full filter rail (neighborhood facets, price+beds ranges, source multiselect, no-fee toggle, found daterange) + collection tabs (All/New24h/New7d/Starred) + sort + search. Addressable: list filter state URL-encoded (?f={source:[manual]}); detail route /app/apartments/<id> renders field table + shared Notes editor + History timeline. Auth rides session cookie. Left-nav Apps from /api/views. Star toggles visually ★<->☆ and persists (host annotations). ask/navigate deferred to .6.
