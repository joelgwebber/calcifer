---
id: calcifer-1d51.5
title: Apartments view manifest — first consumer (v0 milestone, end-to-end)
type: task
priority: 2
created: '2026-07-06T18:21:14Z'
updated: '2026-07-06T18:45:58Z'
depends_on:
- calcifer-1d51.1
- calcifer-1d51.2
- calcifer-1d51.3
- calcifer-1d51.4
labels:
- skill-views
- nyc-apt
---

V0 MILESTONE. Ship the nyc-apt view manifest end-to-end. Switch listings.db to journal_mode=DELETE for host cross-mount reads. Manifest: fields (address/price/beds/neighborhood/source/no_fee/first_seen_at/photo/url); collections New-today + Starred; filters (price range, beds, source multiselect, no-fee toggle, date range); card (address/price/beds/badges/star+open); detail (gallery + price-history timeline from the sightings table + open listing). Acceptance: at /app/apartments browse today's finds, filter, star/unstar (persists, shared), open the listing, deep-link a record — all without waking the agent. First consumer that validates the general mechanism.

---
▸ 2026-07-06T18:45:58Z
Apartments manifest shipped (container/skills/nyc-apt/view.json). Wiring aligned: web:joel re-pointed from The Hearth -> dm-with-joel (ag-1777141351652-tx7j2h) where the nyc-apt monitor + listings.db actually live (each family member has their own 'Calcifer' agent group; dm-with-joel is Joel's). per-thread wiring + auto reply destination created. Journal mode left WAL: host read-only reads verified fresh against WAL, so DELETE is not required for read-only host access (revisit only if staleness ever appears). VERIFIED over live HTTP as authed web:joel: /api/views, /api/views/apartments (manifest), data recent (total 7 + source facets), filters, starred collection, POST /api/annotations (star), record+4pt timeline. Visual /app/apartments click-through pending owner.
