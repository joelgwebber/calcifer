---
id: calcifer-7c3a.5
title: 'Web UI: human-in-the-loop approvals as inline tool UI'
type: feature
priority: 2
created: '2026-06-13T12:00:00Z'
updated: '2026-06-13T12:00:00Z'
---

PARENT YAK: calcifer-7c3a

The headline differentiator over reusing Telegram/Matrix: render nanoclaw's
approval flow (and OneCLI credentialed-action approvals) as rich inline UI
instead of a text DM.

## Concept

- Today approvals go out via `pickApprover` + `pickApprovalDelivery` → a card/
  text DM to an admin; the response comes back via onAction / dispatchResponse.
- For web: surface a pending approval as an inline message part with
  Approve/Deny (and option) buttons. A click issues a command back over the
  transport → host → existing approval handler (dispatchResponse).
- assistant-ui patterns to use: human/interactive tool UI, `onAddToolResult`,
  and the LangGraph "approval UI" tutorial as a reference shape.

## Work

- Map pending approvals (pending_approvals / pending_questions) to a message
  part the frontend can render with action buttons.
- A `POST /api/action` (or a typed send command) carrying { questionId/approvalId,
  selectedOption, userId } → route to `dispatchResponse`. Note: the current
  onAction signature doesn't surface platformId/threadId; handlers look those up
  from the pending row — keep that contract.
- Ensure approver resolution still works once auth (7c3a.6) ties web users to
  roles.

## Depends on

7c3a.4 (card rendering) and ideally 7c3a.6 (so the approver is a real web user).
