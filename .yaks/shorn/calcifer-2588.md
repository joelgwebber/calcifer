---
id: calcifer-2588
title: 'Interactive record cards: hoist a view record into chat as a live card'
type: feature
priority: 2
created: '2026-08-15T16:00:27Z'
updated: '2026-08-15T16:07:39Z'
labels:
- skill-views
- web-ui
- cards
---

---
▸ 2026-08-15T16:07:39Z
Interactive record cards shipped: agent send_record_card({view,id}) -> record_card outbound -> host cardFromContent resolves via manifest.list.card + live annotations + fs image thumbnail -> frontend RecordCard (thumbnail, subtitle, badges, live star toggle, Open deep-link). Reuses the existing card message plumbing (deliver+history both route through cardFromContent). Follow-up: non-web fallback (child idea).
