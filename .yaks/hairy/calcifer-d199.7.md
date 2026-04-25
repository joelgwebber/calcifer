---
id: calcifer-d199.7
title: Wire projects/ dir into dm-with-joel container via additionalMounts
type: task
priority: 2
created: '2026-04-25T20:57:44Z'
updated: '2026-04-25T20:57:44Z'
---

The project tool looks for configs at /workspace/agent/projects/*/config.yaml, but the configs live at the repo root projects/. Fix: add an additionalMount in groups/dm-with-joel/container.json pointing the repo-root projects/ dir to /workspace/agent/projects/ (read-only). This unblocks start_project for hello-world and gnusto without moving files. Part of d199.4 (project IPC modernization) scope.
