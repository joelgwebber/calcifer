---
id: calcifer-11b1
title: Hard-block fastmail-native compose_event (MCP-UI tool, no headless surface)
type: task
priority: 2
created: '2026-09-03T22:12:45Z'
updated: '2026-09-03T22:14:07Z'
labels:
- fastmail
---

Follow-on to a9d9. The a9d9 skill guidance ('never use compose_event') is on-demand/description-gated, so the agent ignored it and called compose_event anyway (twice, live) — staging phantom events + producing no card (NanoClaw has no MCP-UI widget host). compose_event fits the exact category already in SDK_DISALLOWED_TOOLS (providers/claude.ts: DesignSync/ReportFindings = tools with no headless host surface). Add mcp__fastmail-native__compose_event to SDK_DISALLOWED_TOOLS so the SDK filter drops it AND the preToolUse hook blocks it if it slips through — the agent physically can't reach the broken path, forcing create_event/update_event. Reliable where the skill wasn't. NOTE: does NOT give a confirmation card — that's the separate native-card path (ask_user_question/send_card), a UX decision.

---
▸ 2026-09-03T22:14:06Z
SHORN. Added mcp__fastmail-native__compose_event to SDK_DISALLOWED_TOOLS (providers/claude.ts). Now double-blocked: the SDK disallowedTools filter drops it AND the preToolUse hook blocks it at call time ('not available in this environment') if it slips through. Specific-tool block — the rest of mcp__fastmail-native__* (create_event/update_event/search_events/email) stays allowed. Fits the existing rationale (DesignSync/ReportFindings = tools with no headless host surface). Test added to claude.tool-collisions.test.ts (compose_event blocked, create_event not). Typecheck clean, 4 pass. Bind-mounted source → recycled Joel's group. This ENFORCES what the a9d9 on-demand skill couldn't. Does NOT add a confirmation card — native send_card/ask_user_question is the separate card path (UX decision pending).
