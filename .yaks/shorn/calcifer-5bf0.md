---
id: calcifer-5bf0
title: B · Conversation management (rename, archive, rescue)
type: feature
priority: 2
created: '2026-08-23T22:03:02Z'
updated: '2026-08-25T23:16:31Z'
parent: calcifer-d483
labels:
- web-ui
---

Spine B. Rename + archive + rescue for conversations. Foundational blocker: there is no per-thread metadata store today — listThreads() recomputes each title from the thread's first message on every load, and the client store's renameThread/deleteThread are local-only (clobbered by hydrateThreadList on reload). B0 adds that store; B1-B4 build on it. Archive is the primary soft-delete (demote/remove hard delete). Root: B0.
