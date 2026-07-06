---
id: calcifer-1d51.5
title: Apartments view manifest — first consumer (v0 milestone, end-to-end)
type: task
priority: 2
created: '2026-07-06T18:21:14Z'
updated: '2026-07-06T18:21:14Z'
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
