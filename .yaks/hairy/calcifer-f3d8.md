---
id: calcifer-f3d8
title: 'PR upstream: fix Discord ready race condition in discord.ts'
type: task
priority: 3
created: '2026-04-19T15:50:06Z'
updated: '2026-04-25T01:00:29Z'
---

Contribute the Discord ready-event race condition fix back to upstream nanoclaw (https://github.com/qwibitai/nanoclaw).

## Root cause

discord.js v14 fires 'ready' synchronously during the ws.connect() call inside login(), because @discordjs/ws's internal WebSocketShard.connect() uses events.once(shard, 'ready') to resolve its promise, and discord.js's WSWebSocketShardEvents.Ready handler calls triggerClientReady() → emit('ready', client) synchronously in the same event chain — before that promise resolves and login() returns. Registering once('ready') after await login() therefore always misses the event on session resumption, producing a silent 60s timeout on every startup and leaving Discord out of the channels array (messages stored but never processed).

## Fix

Register the connectPromise (with the once('ready') listener) BEFORE calling login(), so the event is captured regardless of when it fires.

## Steps to PR

1. Fork https://github.com/qwibitai/nanoclaw on GitHub
2. Add fork remote and push branch:
   git remote add fork https://github.com/<you>/nanoclaw.git
   git fetch upstream main
   git checkout -b fix/discord-ready-race upstream/main
   git am <patch file>  # see attached artifact
   git push fork fix/discord-ready-race
3. Open PR: fork:fix/discord-ready-race → qwibitai/nanoclaw:main
4. Include root cause explanation in PR description (see above)

![git format-patch for the Discord ready race condition fix](artifacts/nanoclaw-f3d8/discord-ready-race.patch)
