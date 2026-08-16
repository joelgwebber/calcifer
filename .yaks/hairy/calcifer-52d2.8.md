---
id: calcifer-52d2.8
title: Deduplication and address normalization
type: task
priority: 2
created: '2026-06-23T21:15:32Z'
updated: '2026-06-23T21:15:32Z'
parent: calcifer-52d2
---

Use NYC Geoclient API (free, nyc.gov) to normalize addresses across sources (same unit may appear on StreetEasy, Compass, and Craigslist simultaneously). Maintain SQLite table of seen listing fingerprints (normalized address + unit + price). Suppress duplicate alerts across sources.
