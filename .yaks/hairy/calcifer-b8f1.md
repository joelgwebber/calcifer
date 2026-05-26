---
id: calcifer-b8f1
title: 'Upstream PR: group_context formatter + trigger priority cap (from calcifer-2436)'
type: task
priority: 4
created: '2026-05-26T00:00:00Z'
updated: '2026-05-26T00:00:00Z'
---

Contribute the two agent-runner changes from calcifer-2436 back to NanoClaw upstream:

1. **formatter.ts** — `formatChatMessages` splits the batch by `trigger` value and wraps trigger=0 rows in `<group_context note="ambient conversation — ...">` so the agent knows not to respond to accumulated group chat. trigger=1 rows remain as plain `<message>` blocks. Backwards-compatible: normal DM conversations (all trigger=1) produce identical output.

2. **db/messages-in.ts** — `getPendingMessages` prioritises trigger=1 rows in the ORDER BY so an @mention is never squeezed out of the maxMessagesPerPrompt cap by a flood of trigger=0 group chatter. `ORDER BY (CASE WHEN trigger=1 THEN 0 ELSE 1 END), seq DESC`.

Both changes are self-contained and carry tests. The formatter test suite adds six cases for the group_context path; the messages-in change is covered by the poll-loop's existing gate test.

Before filing: check whether the channels branch already has something in this area (it had the whatsapp isMention fix ahead of main). If there's a related open issue (likely filed as a companion to #2560 / #2565 once group wiring is documented), file against that.

Upstream repo: https://github.com/qwibitai/NanoClaw
Contributing guide: CONTRIBUTING.md (read before writing the PR description — check the checklist)
