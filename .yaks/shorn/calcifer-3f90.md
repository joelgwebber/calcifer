---
id: calcifer-3f90
title: 'Post-sync: adopt upstream memory subsystem + run /migrate-memory + clear bespoke
  cruft'
type: task
priority: 2
created: '2026-08-22T19:05:38Z'
updated: '2026-08-22T20:27:24Z'
parent: calcifer-80c5
labels:
- memory
---

BLOCKED ON /update-nanoclaw. Once synced to upstream's memory subsystem: (1) run /migrate-memory to absorb legacy (CLAUDE.md/CLAUDE.local.md memory notes, Claude auto-memory dir, .seed.md). (2) Re-home our session's bespoke memory: move person_jay + any facts from /home/joel/Seafile/{family-wiki,joel-wiki}/memory/ into upstream's memory tree (groups/<folder>/memory/), conforming to OKF (type: person frontmatter + okf_version on index). (3) Remove the bespoke 'Durable memory' contract block from groups/dm-with-joel/CLAUDE.local.md (superseded by definition.md); move any persona/role bits to instructions.prepend.md. (4) Verify simple-memory stayed removed from all 3 group configs; verify the session-hook auto-injection is active for Claude. (5) Delete the now-empty bespoke wiki memory/ scaffold if not repurposed for discoverability (see sibling).

---
▸ 2026-08-22T20:02:56Z
UNBLOCKED (sync landed a610a218). Progress this session: (1) Removed the bespoke 'Durable memory' contract block from groups/dm-with-joel/CLAUDE.local.md — replaced with a one-line comment pointing at the upstream subsystem (memory/index.md + system/definition.md auto-injected; docs/memory.md). CLAUDE.local.md is still loaded by the Claude engine (settingSources 'local'), so the rest of that file (persona, yaks, here.now, nyc-apt, channels) stays. (2) Verified simple-memory is absent from all 3 group container_configs. REMAINING — do AFTER the rebuilt container boots the new code (ensureMemoryScaffold creates groups/<folder>/memory/{index.md,system/definition.md} on boot): (a) run /migrate-memory per group to absorb any legacy CLAUDE.md/.seed.md/Claude-auto-memory notes; (b) re-home Jay (currently preserved at /home/joel/Seafile/family-wiki/memory/people/jay.md) into the correct group's OKF memory tree with 'type: person' frontmatter — placement (family group vs dm-with-joel) is 7860's call once the shared family group (5ecc) exists; (c) delete the bespoke wiki memory/ scaffolds (family-wiki/memory/index.md, joel-wiki/memory/index.md) once Jay is re-homed; (d) confirm session-hook auto-injection fires for the Claude provider on a fresh window. Optional persona move to instructions.prepend.md left as polish (CLAUDE.local.md persona still works for claude-only).

---
▸ 2026-08-22T20:27:04Z
DONE (post-restart). dm-with-joel memory fully consolidated on the upstream OKF subsystem: scaffold auto-created on container boot (memory/index.md + system/definition.md); no legacy to migrate (no .seed.md / imported-agent-memory / Claude auto-memory anywhere — 619d had already cleared the orphans; /migrate-memory is a no-op for all 3 groups). Re-homed Jay as an OKF 'person' concept at groups/dm-with-joel/memory/people/jay.md (type: person + title/description); added lean pointers to memory/index.md Core Memory + Map. Deleted the bespoke wiki memory/ scaffolds (family-wiki/memory, joel-wiki/memory) — wikis themselves preserved. Removed the bespoke 'Durable memory' block from CLAUDE.local.md earlier. VERIFIED end-to-end: a fresh web smoke test got 'OK — Jay' — the agent recalled Joel's daughter purely from auto-injected memory. dm-with-alicia + the-hearth will scaffold cleanly on their next message (no legacy). NOTE: the outage that blocked all channels post-restart was the OneCLI /v1 gateway break, now fixed (see separate note on 80c5).
