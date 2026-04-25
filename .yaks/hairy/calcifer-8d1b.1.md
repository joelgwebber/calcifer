---
id: calcifer-8d1b.1
title: Add /status dashboard endpoint to HTTP API
type: task
priority: 2
created: '2026-04-22T23:05:48Z'
updated: '2026-04-22T23:05:48Z'
---

Extend the existing HTTP API with a GET /status/dashboard endpoint (or serve a static HTML page). Data to expose: service uptime, last restart, active container runs, message counts per channel (last 24h), next scheduled tasks. JSON for the page to poll.
