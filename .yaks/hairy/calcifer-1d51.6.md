---
id: calcifer-1d51.6
title: 'Chat <-> view bridging: card Open-links + ask action'
type: task
priority: 3
created: '2026-07-06T18:21:14Z'
updated: '2026-07-06T18:21:14Z'
depends_on:
- calcifer-7c3a.4
- calcifer-1d51.4
labels:
- skill-views
- web-ui
---

Post-v0. Make inline chat cards (7c3a.4) projections of view records: a card carries an Open affordance deep-linking to /app/<view>/<record_id>. Add the ask action to views: POST /api/send a templated message to the agent (e.g. draft an inquiry for {address}), bridging the direct data plane back to conversational smarts. Acceptance: show-me-today-apartments yields a card that links into the view; an ask action from a listing starts an agent turn in chat.
