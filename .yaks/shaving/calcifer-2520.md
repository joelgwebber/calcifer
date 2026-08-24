---
id: calcifer-2520
title: A · Responsive layout & unified navigation
type: feature
priority: 2
created: '2026-08-23T22:03:02Z'
updated: '2026-08-24T03:42:21Z'
parent: calcifer-d483
labels:
- web-ui
---

Spine A. Mobile-first responsive shell. Today the chat route stacks TWO left surfaces (the app rail + the conversations sidebar) into a 3-column desktop layout that does not work on mobile. Treat 'collapse' and 'mobile drawer' as the same panel-visibility state rendered differently per breakpoint. Modes: desktop 3-pane (rail + conversations independently collapsible, persisted), tablet 2-pane, mobile 1-pane with a SINGLE merged drawer combining Chat / Apps / Conversations. Tap-first affordances throughout (native wrapper coming). Root: A1.
