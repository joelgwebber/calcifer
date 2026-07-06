---
id: calcifer-1d51.7
title: Post-v0 extensibility tiers + more primitives (roadmap)
type: idea
priority: 4
created: '2026-07-06T18:21:14Z'
updated: '2026-07-06T18:21:14Z'
depends_on:
- calcifer-1d51.4
labels:
- skill-views
---

Roadmap capture (NOT v0). (a) Custom-backend tier: data.type=http proxy (host forwards authed requests to a skill endpoint) and/or a registerViewProvider-style in-host module (mirrors channel/provider install; runs in-host with full privileges -> owner-gated) — all BEHIND the /api/views/<view> auth namespace, never a parallel public port. (b) More primitives: document/prose + intra-view navigate action (wiki: internal link -> record; needs HTML sanitization) and tree/browser + byte/download endpoint (seafile; shares plumbing with attachments 7c3a.3); both via data.type=http. (c) Far tiers: sandboxed iframe+bridge custom render (MCP-Apps-inspired) and live view updates via SSE. Keep data.type + primitive/action sets as OPEN enums so all of this slots in without a redesign.
