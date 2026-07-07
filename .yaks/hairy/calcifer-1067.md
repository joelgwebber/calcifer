---
id: calcifer-1067
title: Chat SDK bridge drops send_card actions that use {href} instead of {url}
type: bug
priority: 3
created: '2026-07-07T22:10:32Z'
updated: '2026-07-07T22:10:32Z'
labels:
- chat-sdk
- send-card
---

chat-sdk-bridge.ts card branch filters actions by typeof a.url === 'string', but the agent emits send_card actions as {type:'url', label, href} in practice (confirmed while building 7c3a.4). So URL link buttons are silently dropped on Discord/Slack/Telegram. Fix: accept url OR href (mirror the tolerance added to src/channels/web-cards.ts normalizeCard). One-liner + a bridge test case.
