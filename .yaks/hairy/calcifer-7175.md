---
id: calcifer-7175
title: 'Delivery receipts: sender learns delivered/surfaced (deferred)'
type: idea
priority: 4
created: '2026-09-02T03:32:16Z'
updated: '2026-09-02T03:32:16Z'
parent: calcifer-dc2b
depends_on:
- calcifer-2279
labels:
- agent-to-agent
---

Owner decision #3: the sender's Calcifer learns whether a relayed message was delivered and/or actually surfaced to the recipient. Useful but explicitly DEFERRED. Rides on the a2a return path established by reply routing (2279) — a lightweight ack hop back to the source session. Revisit after the core threading + reply loop are proven.
