---
id: calcifer-d254
title: Container killed mid-turn can strand the web running indicator (stale activity_status)
type: bug
priority: 3
created: '2026-09-03T16:17:21Z'
updated: '2026-09-03T16:17:21Z'
labels:
- web-ui
---

Follow-on edge from calcifer-4dad. Web running is now driven solely by the status side-channel: 'Working…' opens the envelope at turn start, and processQuery's finally clears activity_status at turn end (even on error) -> host emits status=null -> running clears. BUT if a container is KILLED mid-turn (SIGTERM/absolute-ceiling/idle reap) before that finally runs, activity_status stays set in the outbound session_state, the host keeps emitting the last label (running=true), and no status=null ever comes -> web spinner stranded until the user reloads. Fix: host-side safety — when a session's container stops/ends (killContainer / session end path in container-runner.ts + delivery lastStatusBySession), emit a final status=null for that session's origin thread so the web client clears. Narrow (only bites on mid-turn kills, which also lose the turn's work), but it's the last gap in the 'running indicator always clears' invariant.
