---
id: calcifer-2436
title: 'Add mention-context engage mode: react to @mentions with trailing group context'
type: feature
priority: 2
created: '2026-04-25T23:31:43Z'
updated: '2026-04-25T23:31:43Z'
---

Add a new engage mode ideal for family/group chats: agent only wakes on @mentions, but when it does, it sees recent ambient conversation as background context.

This is already mechanically possible by combining engage_mode='mention' + ignored_message_policy='accumulate' — non-mention messages are stored with trigger=0, @mentions wake the agent which then reads all pending messages together.

Work required:
1. Agent-runner formatter: present accumulated (trigger=0) messages as 'recent conversation context' rather than as messages to respond to — prevents the agent from trying to answer every accumulated message
2. Context cap: add a max_context_messages limit per wiring (or global default) with a trim strategy — a busy group could accumulate thousands of messages before an @mention
3. New named engage_mode 'mention-context' as a first-class option that sets both engage_mode and ignored_message_policy together, so it's one knob instead of two
4. Wire up the family agent group with this mode once implemented

Primary use case: family WhatsApp/Telegram group where Calcifer is present but quiet, responds when summoned, and has enough ambient context to give useful answers.
