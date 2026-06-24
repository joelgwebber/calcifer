---
id: calcifer-3250
title: Fix IMAP search criteria format in Fastmail MCP
type: task
priority: 3
created: '2026-06-03T15:38:35Z'
updated: '2026-06-03T15:38:38Z'
---

Flat array ['SUBJECT','x'] was passed directly to node-imap; needs nested [['SUBJECT','x']]. Added parseSearchCriteria() helper and error handler to prevent MCP crash.
