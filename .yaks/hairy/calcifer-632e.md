---
id: calcifer-632e
title: Recipient-Calcifer channel choice (two-hop surfacing)
type: feature
priority: 2
created: '2026-09-02T03:32:08Z'
updated: '2026-09-03T16:26:53Z'
depends_on:
- calcifer-bd2f
labels:
- agent-to-agent
---

Owner decision #1: the RECIPIENT's Calcifer picks the surfacing channel (it knows which channels the user is active on; can learn preferences over time) rather than the sender hard-routing into a channel. Option B (two-hop): a2a lands in the recipient's agent, whose Calcifer chooses channel + correspondent thread, then surfaces. Needs richer send-addressing (channel + optional thread) beyond today's single-target send. Depends on the durable thread (226a) + correspondent keying (bd2f) existing to surface into.

---
▸ 2026-09-03T16:26:53Z
Hoisted out of the dc2b herd to root (deferred future work, per owner: '632e is a separate later step'). CONTEXT: dc2b delivered the durable per-correspondent delivery path — 226a (durable web thread), bd2f (correspondent label), 2279 (reply routing), eedc (relay conduct). 632e is the remaining REFINEMENT: decision #1 (recipient's Calcifer picks the surfacing channel + learns preferences) via the two-hop model, replacing 226a's current hard-route-to-web. Only matters when a recipient is genuinely active on MULTIPLE multi-thread channels — not the current family setup (anais/jay web-only; alicia WhatsApp-primary via agent-shared). Pick up when a multi-channel recipient makes channel choice load-bearing.
