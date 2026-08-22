---
id: calcifer-80c5
title: 'Memory architecture: wiki-backed durable memory + consolidation'
type: feature
priority: 2
created: '2026-08-22T15:16:48Z'
updated: '2026-08-22T15:17:05Z'
labels:
- memory
---

Rework agent memory into a clean, low-complexity model, grounded in how nc actually works.

GROUND TRUTH (verified this session):
- nc drives the Claude Code engine via @anthropic-ai/claude-agent-sdk (pathToClaudeCodeExecutable=/pnpm/claude), cwd=/workspace/agent, systemPrompt preset=claude_code + appended nc instructions, settingSources=['project','user','local'].
- 'Claude-native memory' = the CLAUDE.md hierarchy ONLY. Auto-in-context each turn = composed /workspace/agent/CLAUDE.md (which @imports the shared base container/CLAUDE.md + module/skill fragments) + CLAUDE.local.md (loaded via settingSources 'local'). Nothing else is auto-loaded.
- The memory/MEMORY.md + person_jay.md under .claude-shared/projects/-workspace-agent/memory/ are ORPHANS: no code/skill/instruction/@import references them; nothing reads or curates them. An abortive attempt.
- Simple Memory MCP: code ships in trunk agent-runner but is NOT a default; we opted it into all 3 groups' container.json (dm-with-joel, dm-with-alicia, the-hearth). Defaults to per-session /workspace/memory (siloed) and is EMPTY/unused. Another abortive attempt.
- Wikis are LOCAL mounted files (fast, read-after-write consistent; Seadrive syncs in background): personal /workspace/extra/{user}-wiki/ (e.g. joel-wiki) + shared /workspace/extra/shared/family-wiki/. Family wiki already renders in the web UI. Personal/family split already exists => maps onto shared-vs-personal memory with zero new infra.

TARGET (owner-approved direction): two tiers, both leaning on what nc already has, plus a curation loop.
1. Always-in-context (tiny, curated): CLAUDE.local.md — persona/routing + a short pinned-facts block + POINTERS to the memory docs.
2. Durable semantic (consult on demand): special wiki docs — personal facts in the user's wiki, shared/family facts in family-wiki. Discoverable + human-editable in the wiki UI; agent reads/writes local files.
3. Consolidation task (scheduled): distill recent conversation transcripts -> update the wiki memory docs (personal vs family) + refresh CLAUDE.local.md pinned essentials + prune stale.
Retire Simple Memory MCP. Skip Anthropic memory_20250818 tool (CLI/API-only store, opposite of the discoverability goal; avoid extra complexity).

Open convention choice: dedicated memory/ area per wiki vs woven into normal wiki structure.
