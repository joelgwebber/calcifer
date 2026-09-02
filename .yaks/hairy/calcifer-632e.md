---
id: calcifer-632e
title: Recipient-Calcifer channel choice (two-hop surfacing)
type: feature
priority: 2
created: '2026-09-02T03:32:08Z'
updated: '2026-09-02T03:32:08Z'
parent: calcifer-dc2b
depends_on:
- calcifer-bd2f
labels:
- agent-to-agent
---

Owner decision #1: the RECIPIENT's Calcifer picks the surfacing channel (it knows which channels the user is active on; can learn preferences over time) rather than the sender hard-routing into a channel. Option B (two-hop): a2a lands in the recipient's agent, whose Calcifer chooses channel + correspondent thread, then surfaces. Needs richer send-addressing (channel + optional thread) beyond today's single-target send. Depends on the durable thread (226a) + correspondent keying (bd2f) existing to surface into.
