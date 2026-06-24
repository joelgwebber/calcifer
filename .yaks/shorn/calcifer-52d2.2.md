---
id: calcifer-52d2.2
title: StreetEasy monitor via internal GraphQL API
type: task
priority: 2
created: '2026-06-23T21:15:32Z'
updated: '2026-06-23T21:46:32Z'
---

Use the streeteasy-api npm package (github.com/evandcoleman/streeteasy-api, v0.4.0 May 2026) to poll StreetEasy every 5-10 min. Full filter support: neighborhoods, price, beds, pets, amenities. Needs residential proxy for PerimeterX bypass. Store seen listing IDs in SQLite to deduplicate.
