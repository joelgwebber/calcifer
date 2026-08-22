---
id: calcifer-619d
title: Retire Simple Memory MCP + clean up orphaned memory files
type: task
priority: 2
created: '2026-08-22T15:17:05Z'
updated: '2026-08-22T15:42:24Z'
parent: calcifer-80c5
labels:
- memory
---

Remove simple-memory from all 3 groups' container configs (dm-with-joel, dm-with-alicia, the-hearth) via ncl groups config remove-mcp-server. It's empty + per-session + unused. Then migrate the one real orphaned fact (person_jay.md -> family-wiki, since Jay is a family member) and delete the stray .claude-shared/projects/-workspace-agent/memory/ files. Verify no other memory_* usage depends on it.

---
▸ 2026-08-22T15:18:40Z
MCP removed from all 3 groups via ncl groups config remove-mcp-server (dm-with-joel, dm-with-alicia, the-hearth) — confirmed {removed: simple-memory} each. Takes effect next spawn (container.json regenerates from DB). DEFERRED to land with the contract (cd6c): migrating the one real orphaned fact (person_jay.md -> family-wiki) + deleting the stray .claude-shared memory files, since the destination depends on the chosen wiki convention.

---
▸ 2026-08-22T15:42:24Z
COMPLETE. Migrated person_jay.md -> /home/joel/Seafile/family-wiki/memory/people/jay.md (cleaned frontmatter) and deleted the orphaned .claude-shared/projects/*/memory/ dirs across all sessions. Simple Memory MCP already removed from all 3 groups.
