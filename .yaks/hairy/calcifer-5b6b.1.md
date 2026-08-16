---
id: calcifer-5b6b.1
title: 'Backend: surface mid-turn activity (tool calls / thinking) from Claude SDK'
type: task
priority: 2
created: '2026-08-16T15:24:40Z'
updated: '2026-08-16T15:24:40Z'
---

Container-side (Bun; needs ./container/build.sh rebuild).

In container/agent-runner/src/providers/claude.ts translateEvents(), the SDK 'assistant' messages carry content blocks (tool_use with a tool name + input, thinking, text) mid-turn. Today these are collapsed to a bare {type:'activity'} ping. Extract a human-facing label from them and emit a structured event so downstream layers can show WHAT the agent is doing.

Approach:
- Map assistant tool_use -> a concise label (e.g. 'Reading listings.db', 'Searching the web', 'Running search'); map thinking -> 'Thinking…'; optionally partial text -> 'Writing…'. Keep a small tool-name->verb table; fall back to the raw tool name for unknown/MCP tools.
- Emit via the existing {type:'progress'; message} event (already in ProviderEvent) OR a new dedicated {type:'activity'; label} richer variant. Prefer reusing 'progress' if the semantics fit; otherwise widen the union. Keep the bare liveness 'activity' ping for the idle timer.
- Don't leak secrets / full tool inputs into labels (paths/queries ok, but be conservative).

Out of scope: delivering these as transcript messages. They are ephemeral status only (see transport child).
