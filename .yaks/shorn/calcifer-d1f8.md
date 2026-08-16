---
id: calcifer-d1f8
title: Implement markdown rendering in chats
type: feature
priority: 2
created: '2026-08-16T18:42:58Z'
updated: '2026-08-16T18:48:02Z'
parent: calcifer-7c3a
labels:
- ui
---

Agents happily produce markdown (and users can input it themselves), but the rendered chat bubbles just display it as raw text.

---
▸ 2026-08-16T18:48:02Z
Done. Chat text parts now render markdown by overriding assistant-ui's MessagePrimitive.Parts components.Text with a MarkdownText component that reuses the existing source-agnostic Prose primitive (react-markdown + remark-gfm) — the same renderer the wiki/doc views use. Applied to both user and assistant bubbles. Added chat-scoped CSS: .message-bubble .prose sheds the doc margins + resets the bubble's pre-wrap; .message-user .prose overrides keep links/code/quotes/tables legible on the blue bubble. Raw HTML stays inert (no rehype-raw). Frontend-only (Thread.tsx + styles.css); tsc+vite build clean; browser reload to pick up.
