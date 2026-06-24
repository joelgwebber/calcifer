---
id: calcifer-7c3a.4
title: 'Web UI: render send_card payloads as message parts (generative UI)'
type: task
priority: 3
created: '2026-06-13T12:00:00Z'
updated: '2026-06-13T12:00:00Z'
---

PARENT YAK: calcifer-7c3a

nanoclaw's `send_card` writes outbound rows with `kind:'chat-sdk'` and content
`{ type:'card', card, fallbackText }` (title / description / children / actions
with url buttons). The Chat SDK bridge already renders these for Discord/Slack;
the web adapter currently text-only-drops them.

## Work

- Web adapter `deliver`: detect `kind:'chat-sdk'` + `content.type==='card'`,
  forward the structured card over SSE (new event or a typed message payload)
  instead of flattening to text.
- Frontend: render cards as assistant-ui message parts / a small card component
  (title, body, link buttons). Reuse the card shape from the existing bridge so
  the two renderers stay consistent.
- Fallback to `fallbackText` when a card can't be rendered.

## Depends on

Pairs naturally with 7c3a.5 (approvals are a specialized interactive card).
