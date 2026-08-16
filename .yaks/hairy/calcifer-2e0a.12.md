---
id: calcifer-2e0a.12
title: Progress updates from builder agent
type: feature
priority: 2
created: '2026-04-27T02:56:30Z'
updated: '2026-04-27T02:56:30Z'
parent: calcifer-2e0a
---

It would be really useful to get status updates from long-running builder runs, perhaps every 5m?
Perhaps we could make it variable, by just instructing the agent to do whatever the user says --
e.g., if they say "stop sending updates", "start with those updates again", "I want an update every
minute", and so forth.

I'm assuming the high-level request interpretation would need to be handled by Calcifer.
