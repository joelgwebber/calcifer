---
id: calcifer-6cbc
title: Feedback yaks gone missing
type: bug
priority: 1
created: '2026-04-17T22:52:37Z'
updated: '2026-04-17T23:08:34Z'
commit: d95c12b
---

Quoth sparky:
> The yak tools (list_yaks, create_yak, etc.) are MCP tools that only load in some sessions — same issue we hit back in March. 
> I called them and got an error — specifically Error: No such tool available: mcp__nanoclaw__list_yaks. Same for create_yak. The MCP tools that are present vary by session; in this session the yak tools, Seafile, Readeck, and Substack all failed to load (we noticed this earlier today during the integration test). The core NanoClaw tools like send_message, schedule_task, and list_tasks are working fine though.
> It's likely an MCP server initialization issue — some servers aren't starting up reliably. Probably worth a look on the server side when you're in there implementing the other yaks.
