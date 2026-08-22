---
id: calcifer-80c5
title: 'Memory: converge on upstream''s provider-agnostic memory subsystem'
type: feature
priority: 2
created: '2026-08-22T15:16:48Z'
updated: '2026-08-22T19:05:04Z'
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

---
▸ 2026-08-22T19:05:04Z
DIRECTION CHANGE (upstream scan, this session). Upstream qwibitai/NanoClaw is v2.2.0, 911 commits ahead of our merge-base (24922593, 2026-05-25). It has built a mature PROVIDER-AGNOSTIC persistent-memory subsystem we should converge on instead of building bespoke. Decision: run /update-nanoclaw first, then adopt upstream memory; do NOT finish our bespoke contract/consolidator.

UPSTREAM MODEL (docs/memory.md; container/agent-runner/src/memory/):
- File-based Markdown per agent group at groups/<folder>/memory/ = /workspace/agent/memory/. No DB/embeddings.
- memory/index.md (Core Memory + map) + memory/system/definition.md (agent-owned doctrine) are AUTO-INJECTED into context on every fresh window (startup/clear/compaction) via a provider-agnostic session-start hook; 16k cap each; detail followed JIT via links.
- OKF (Open Knowledge Format) v0.1: one concept per file, YAML 'type' frontmatter (person/project/decision...); portable across providers.
- Role/persona -> /workspace/agent/instructions.prepend.md; transcripts -> conversations/.
- /migrate-memory skill absorbs legacy (CLAUDE.md notes, Claude auto-memory dir, .seed.md, imported-agent-memory.md).
- Scaffold auto-created on boot; never clobbers existing files.

WE CONVERGED on the core (file-based, index-first, headlines+pointers with detail in linked files, human-editable, no DB). Theirs is MORE MATURE: auto-injection > our consult-contract; OKF portability; provider-agnostic; migration skill + rich definition.md doctrine ('remember the approach not the instance', entity-thinking, keep-it-true/prune).

OUR DIVERGENCES TO PRESERVE ON TOP OF UPSTREAM: (1) web-UI discoverability; (2) family-shared vs personal split (maps better to AGENT-GROUP scope: shared family agent group [yak 5ecc] holds family memory, dm-with-joel holds personal — cleaner than our two-wikis idea).

CRUFT TO CLEAR during convergence (created this session, now superseded):
- Bespoke 'Durable memory' contract block in groups/dm-with-joel/CLAUDE.local.md (gitignored) -> superseded by upstream definition.md; remove/replace.
- Bespoke wiki memory scaffold at /home/joel/Seafile/family-wiki/memory/ (index.md + people/jay.md) and /home/joel/Seafile/joel-wiki/memory/index.md -> re-home person_jay content into upstream's tree (or keep wiki as store via symlink if we go that route); otherwise delete.
- Verify simple-memory stays removed from all 3 group configs after the sync.

KEEP (compatible, done): 619d cleanup — simple-memory removed from all 3 groups; orphan Claude-state memory/ files deleted; person_jay content preserved (now in wiki, easily re-homed).

BLOCKED ON: /update-nanoclaw sync (user running next, post-compact).
