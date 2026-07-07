---
id: calcifer-7c3a.4
title: 'Web UI: render send_card payloads as message parts (generative UI)'
type: task
priority: 3
created: '2026-06-13T12:00:00Z'
updated: '2026-07-07T21:54:09Z'
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

---
▸ 2026-07-07T21:54:09Z
DONE + verified end-to-end in browser as web:joel. Host: normalizeCard (new src/channels/web-cards.ts) parses send_card content ({type:'card',...}); web.ts deliver broadcasts a card over the existing 'message' SSE event (message.card); web-history.ts now reads kind IN ('chat','chat-sdk') and re-normalizes so cards survive refresh. Frontend: MyMessage.card, convertMessage emits a tool-call part (toolName 'card', result:{} so it's not treated as running), Thread.tsx registers it via Parts components.tools.by_name.card, new Card.tsx renders title/description/lines/URL-buttons, namespaced .chat-card* CSS (breaks out of the assistant bubble via :has()). Gotcha fixed: agent emits actions as {href} not {url} -> normalizer accepts either. fallbackText -> message text fallback. ask_question (type!='card') intentionally not matched (7c3a.5). Unit tests in web-cards.test.ts (7, green). Verified: live card render, Open-button after href fix, full persistence across reload.
