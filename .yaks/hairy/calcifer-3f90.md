---
id: calcifer-3f90
title: 'Post-sync: adopt upstream memory subsystem + run /migrate-memory + clear bespoke
  cruft'
type: task
priority: 2
created: '2026-08-22T19:05:38Z'
updated: '2026-08-22T19:05:38Z'
parent: calcifer-80c5
labels:
- memory
---

BLOCKED ON /update-nanoclaw. Once synced to upstream's memory subsystem: (1) run /migrate-memory to absorb legacy (CLAUDE.md/CLAUDE.local.md memory notes, Claude auto-memory dir, .seed.md). (2) Re-home our session's bespoke memory: move person_jay + any facts from /home/joel/Seafile/{family-wiki,joel-wiki}/memory/ into upstream's memory tree (groups/<folder>/memory/), conforming to OKF (type: person frontmatter + okf_version on index). (3) Remove the bespoke 'Durable memory' contract block from groups/dm-with-joel/CLAUDE.local.md (superseded by definition.md); move any persona/role bits to instructions.prepend.md. (4) Verify simple-memory stayed removed from all 3 group configs; verify the session-hook auto-injection is active for Claude. (5) Delete the now-empty bespoke wiki memory/ scaffold if not repurposed for discoverability (see sibling).
