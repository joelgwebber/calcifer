---
id: calcifer-e591
title: Fix HTTP API to use full NanoClaw agent context and tools
type: bug
priority: 2
created: '2026-03-07T20:56:50Z'
updated: '2026-03-07T22:13:47Z'
commit: 1bed0c3
---

The HTTP API server (http-server.ts) currently makes direct Anthropic API calls without Sparky context, tools, or memory. It's a vanilla Claude proxy instead of using the full NanoClaw agent system.

PROBLEM:
Lines 208-236 in http-server.ts show the API calls Claude directly with:
- NO system prompt (no Sparky identity or CLAUDE.md context)
- NO tools/MCP access (no Seafile, Fastmail, WorkFlowy, yaks, etc.)
- NO memory or conversation history
- Just raw messages translated from OpenAI format

Result: Open WebUI sees generic Claude, not Sparky with capabilities.

ROOT CAUSE:
HTTP API bypasses the entire NanoClaw agent runner system that:
- Loads CLAUDE.md for context and identity
- Provides MCP tool access
- Manages conversation memory
- Handles message routing and processing

SOLUTION OPTIONS:

Option A: Route through agent runner (preferred)
- HTTP API receives message from Open WebUI
- Create synthetic message in database as if from special "http_api" chat
- Let normal agent runner process it (with full context and tools)
- Stream response back to HTTP API endpoint
- Maintains single code path, all features work

Option B: Duplicate agent logic in HTTP endpoint
- Read CLAUDE.md and build system prompt
- Load all MCP tools
- Initialize conversation memory
- Create full agent context inline
- High maintenance, code duplication

Option C: Shared agent factory
- Extract agent creation logic to shared module
- Both WhatsApp/Telegram channel AND HTTP API use it
- Better than B, but still two execution paths

RECOMMENDED: Option A

Implementation steps:
1. Modify HTTP API chatHandler to write message to database
2. Trigger agent runner for synthetic "http_api" chat
3. Stream agent output back through SSE
4. Add special handling in agent runner for HTTP API context
5. Ensure tools work properly (some may need chat-specific context)

CHALLENGES:
- Agent runner expects WhatsApp/Telegram JID format
- Need synthetic chat ID for HTTP API sessions
- Session management (Open WebUI has no persistent chat ID)
- Tool access that requires chat context (send_message, etc.)
- Streaming response capture and forwarding

ALTERNATIVE QUICK FIX:
At minimum, add system prompt with Sparky identity:
- Read /workspace/group/CLAUDE.md
- Extract key identity and capabilities
- Pass as system parameter to Claude API
- Still no tools, but at least correct identity

Current code location: /workspace/project/src/http-server.ts lines 206-236

Related files:
- src/agent-runner.ts (main agent execution)
- src/channels/*.ts (message routing)
- src/config.ts (ASSISTANT_NAME, etc.)
