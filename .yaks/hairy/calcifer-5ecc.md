---
id: calcifer-5ecc
title: Set up shared family agent group for cross-family messaging
type: feature
priority: 3
created: '2026-04-25T20:57:40Z'
updated: '2026-04-27T02:59:47Z'
---

Create a shared agent group that all family members (Joel, Alicia, kids) can message. Wire each member's accounts (Telegram, WhatsApp, SMS) to this group with session_mode=agent-shared so they share one conversation context. Equivalent to v1's 'shared' group. Family wiki was empty so no content migration needed — just the entity model setup and CLAUDE.local.md for the shared persona.

---
▸ 2026-04-26T00:11:07Z
Design clarified: family wiki coexists with personal wiki in each family member's personal agent. Each agent (dm-with-joel, dm-with-alicia) gets BOTH skills — wiki (private, /workspace/agent/joel-wiki/) and family-wiki (shared, /workspace/shared/family-wiki/). Family group agent gets family-wiki only. All containers mount the same host path RW via additionalMounts so writes are immediately visible across agents. Seafile syncs to cloud for backup/cross-device. This means d199.6 needs the family wiki wiring done first (see new yak), then the family group agent scaffold, then register the group chat and wire it.
