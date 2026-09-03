---
id: calcifer-18ad
title: No yaks CLI in agent containers — agents must hand-write yak markdown
type: task
priority: 3
created: '2026-09-03T15:31:44Z'
updated: '2026-09-03T15:31:44Z'
labels:
- skills
---

The container agent (family Calcifers) has no way to run yaks: the old container/tools/yaks/yak.py was deleted (e3c7d72f) and nothing replaced it; the yaks binary/npm pkg isn't installed in the image. The .yaks/ herd IS mounted (read/write) at /workspace/extra/calcifer-project/.yaks/, so agents CAN file yaks — but only by hand-writing the markdown file (frontmatter + body) and moving files between hairy/shaving/shorn dirs. That's what calcifer-a9d9 and calcifer-c4b7 were reduced to. dm-with-joel/CLAUDE.local.md now documents the hand-write fallback (fixed in a9d9). Proper fix: bake the yaks binary into the agent image (Dockerfile pnpm global-install block, pinned ARG, per the 'Adding a Node CLI the agent invokes at runtime' gotcha) OR ship a thin shim, then restore a real CLI reference in CLAUDE.local.md. Low priority but repeat sessions keep hitting the dead end. Note: hand-writing risks id collisions + malformed frontmatter (no validation).
