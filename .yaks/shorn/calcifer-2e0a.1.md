---
id: calcifer-2e0a.1
title: ask_human IPC tool — core HITL mechanism
type: feature
priority: 1
created: '2026-04-23T18:42:55Z'
updated: '2026-04-23T19:09:57Z'
parent: calcifer-2e0a
---

Add ask_human tool to ipc-mcp-stdio.ts using the existing yak-response pattern.

CHANGES:
1. ipc-mcp-stdio.ts: new ask_human tool + waitForHumanResponse helper (long-poll, hours timeout)
   - Writes request to /workspace/ipc/tasks/ (type: ask_human)
   - Polls /workspace/ipc/responses/ask_human_{id}.json for answer
2. ipc.ts: handle 'ask_human' case in processTaskIpc
   - Send question to chatJid via deps.sendMessage
   - Store pending question in an in-memory Map keyed by groupFolder
   - Expose resolveHumanQuestion(groupFolder, answer) to write response file
3. src/index.ts: check pending questions before routing inbound messages
   - If groupFolder has a pending question, call resolveHumanQuestion and skip LLM

UPSTREAM: This is generic and useful for all NanoClaw installs. Goes directly to core nc repo, not a skill.

TEST: Can be validated immediately with any existing group session — call ask_human from a chat, verify question arrives, reply, verify agent gets the answer.
