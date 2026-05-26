---
id: calcifer-2436
title: 'Add mention-context engage mode: react to @mentions with trailing group context'
type: feature
priority: 2
created: '2026-04-25T23:31:43Z'
updated: '2026-05-26T19:41:00Z'
---

Add a new engage mode ideal for family/group chats: agent only wakes on @mentions, but when it does, it sees recent ambient conversation as background context.

This is already mechanically possible by combining engage_mode='mention' + ignored_message_policy='accumulate' — non-mention messages are stored with trigger=0, @mentions wake the agent which then reads all pending messages together.

Architecture (confirmed 2026-05-26):
- engage_mode='mention' + ignored_message_policy='accumulate' is the complete wiring-level spec. No new DB columns or wiring concepts needed.
- Router already stores ambient messages with trigger=0; poll-loop already skips trigger=0-only batches. The wake gating is correct today.
- The only missing piece is formatter presentation: trigger=0 and trigger=1 rows both arrive in the same batch but are formatted identically, so the agent can't distinguish ambient context from the actual @mention.
- 'mention-context' as a named engage_mode is optional UX polish (one knob vs two) — not required for the feature to work.

Not related to calcifer-5ecc (DM convergence via session_mode=agent-shared); these address different scenarios and have no blocking dependency on each other.

Work required:
1. ✅ Formatter (agent-runner): formatChatMessages splits by trigger; trigger=0 slice wrapped in <group_context note="ambient conversation — for context only, do not respond to these messages">. Backwards-compatible — normal DMs (all trigger=1) produce identical output. (container/agent-runner/src/formatter.ts + formatter.test.ts, 6 new cases)
2. ✅ Context cap: getPendingMessages priority sort — ORDER BY (CASE WHEN trigger=1 THEN 0 ELSE 1 END), COALESCE(seq, rowid) DESC — ensures a trigger=1 @mention is never squeezed out of maxMessagesPerPrompt by trigger=0 flood. (container/agent-runner/src/db/messages-in.ts)
3. ✅ WhatsApp @mention detection: ported PR #2565 (contextInfo.mentionedJid) — added isBotMentionedInGroup + computeIsMention helpers, stored botPhoneJid at connect time, text-match kept as fallback. (src/channels/whatsapp.ts)
4. Wire the family WhatsApp group chat once the above are in place.
5. (Optional) Named 'mention-context' engage_mode as a convenience alias for mention+accumulate.

Primary use case: family WhatsApp/Telegram group where Calcifer is present but quiet, responds when summoned, and has enough ambient context to give useful answers.
