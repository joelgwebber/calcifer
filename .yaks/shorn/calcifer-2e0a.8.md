---
id: calcifer-2e0a.8
title: Add subtext support to background project agents.
type: feature
priority: 2
created: '2026-04-24T15:53:08Z'
updated: '2026-04-24T22:41:14Z'
parent: calcifer-2e0a
---

The preferable path for this would be to install the subtext plugin (https://github.com/fullstorydev/subtext) within project builder agents. But if that's too much of a PITA we can reference the MCP directly with an auth token (rather than oauth). Slightly tricky -- if we install it manually, then we'll likely have to do something to sync the plugin's associated skills so that the builder agent has access to them.
