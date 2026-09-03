---
id: calcifer-7175
title: 'Delivery receipts: sender learns delivered/surfaced (deferred)'
type: idea
priority: 4
created: '2026-09-02T03:32:16Z'
updated: '2026-09-03T16:26:53Z'
depends_on:
- calcifer-2279
labels:
- agent-to-agent
---

Owner decision #3: the sender's Calcifer learns whether a relayed message was delivered and/or actually surfaced to the recipient. Useful but explicitly DEFERRED. Rides on the a2a return path established by reply routing (2279) — a lightweight ack hop back to the source session. Revisit after the core threading + reply loop are proven.

---
▸ 2026-09-03T16:26:53Z
Hoisted out of dc2b to root (explicitly deferred, decision #3). Delivery receipts (sender learns delivered/surfaced) ride on the a2a return path that 2279 established; revisit after the core threading is proven in daily use.
