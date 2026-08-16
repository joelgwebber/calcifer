---
id: calcifer-dc07
title: 'Polish: suppress noisy SDK ToolSearch step from activity labels'
type: task
priority: 3
created: '2026-08-16T18:44:10Z'
updated: '2026-08-16T18:44:43Z'
---

The activity indicator (5b6b) surfaces the SDK's internal ToolSearch tool-discovery step as 'Running tool search', which reads oddly. Skip ToolSearch tool_use blocks when picking an activity label so the label falls through to thinking/text (or stays on the current envelope label). Parked as polish on the 5b6b herd.

---
▸ 2026-08-16T18:44:43Z
Done. describeAssistantActivity now skips ToolSearch tool_use blocks so the label falls through to a real tool/thinking/text (or stays on the 'Working…' envelope). Test updated (9 pass). Live on next container spawn.
