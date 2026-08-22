---
id: calcifer-c7d1
title: 'Reconcile memory discoverability: web view or symlink over groups/<folder>/memory'
type: task
priority: 3
created: '2026-08-22T19:05:38Z'
updated: '2026-08-22T19:05:50Z'
parent: calcifer-80c5
labels:
- skill-views
depends_on:
- calcifer-3f90
---

Upstream memory lives in groups/<folder>/memory/ (not web-viewable, unlike our wiki idea). Restore discoverability WITHOUT diverging: either (a) add a skill-views fs view rooted at the group memory dir so it's browsable in the web UI, or (b) symlink /workspace/agent/memory -> a wiki path so it renders in the existing wiki view. Prefer whichever keeps upstream's module untouched. Depends on adopting upstream memory (sibling).
