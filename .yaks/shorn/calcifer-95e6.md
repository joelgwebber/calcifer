---
id: calcifer-95e6
title: Confirm-before card for fastmail calendar writes (ask_user_question -> create_event)
type: feature
priority: 2
created: '2026-09-03T22:25:50Z'
updated: '2026-09-03T22:27:12Z'
labels:
- fastmail
---

Wire the native confirm-before card path for calendar writes now that compose_event is hard-blocked (11b1). For any calendar create/update, the agent should first render an interactive Confirm/Decline card via ask_user_question (native, works in web UI), then call create_event/update_event only on Confirm. Home: fastmail skill (tracked detailed how-to) + a brief always-on reinforcement in Joel's CLAUDE.local.md (skills are on-demand; persona is reliable — the reliability lesson from a9d9/11b1). This is the 'simple card' path the owner actually wanted; compose_event's MCP-UI widget was never it.

---
▸ 2026-09-03T22:27:12Z
SHORN. Confirm-before card wired for calendar (and other irreversible/user-visible) writes. Two homes: (1) fastmail skill (tracked) gains a 'Confirm before writing to the calendar' section — ask_user_question (native, renders an inline Confirm/Decline card + blocks) with full specifics in the question, then create_event/update_event on Confirm + search_events verify; also noted compose_event is now hard-blocked. (2) Joel's CLAUDE.local.md gains an always-on 'Calendar & other writes — confirm with a card first' block (reliability: skills are on-demand and get skipped — the a9d9/11b1 lesson — so the trigger lives in the always-in-prompt persona). ask_user_question interface confirmed from interactive.ts (title/question/options[, timeout]; blocking; renders chat-sdk ask_question card). Recycled Joel's group (bind-mounted skill + spawn-time persona). This is the 'simple card' the owner wanted; native cards already worked — just needed the behavior wired.
