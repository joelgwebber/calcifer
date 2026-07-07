---
id: calcifer-7c3a.5
title: 'Web UI: human-in-the-loop approvals as inline tool UI'
type: feature
priority: 2
created: '2026-06-13T12:00:00Z'
updated: '2026-07-07T22:36:31Z'
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

---
▸ 2026-07-07T22:36:31Z
DONE + verified end-to-end in browser as web:joel. Unified mechanism: ask_user_question AND host requestApproval AND onecli approvals all emit type:'ask_question' payloads, so one path covers all three. Host: web.ts deliver renders ask_question over the 'message' SSE event (message.question={questionId,title,question,options}); POST /api/action resolves userId from the auth cookie (never client-trusted), validates the option against an in-memory pendingQuestions map (permissive on miss — DB pending row is authoritative), calls config.onAction(questionId,value,userId) -> dispatchResponse, and broadcasts an 'answered' SSE event so all the user's tabs sync. web-history.ts renders reloaded prompts inert (resolved:true). Frontend: MyMessage.question, convertMessage -> tool-call part toolName 'question' (result defined), Thread.tsx registers it, Question.tsx renders title/question/option-buttons -> optimistic answerQuestion + POST; answered shows '✓ selectedLabel', resolved shows inert note. Verified: agent ask_user_question ('Approval test', Approve/Deny) -> card -> clicked Approve -> card '✓ Approve' -> agent unblocked with 'You chose Approve.'
