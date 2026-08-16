---
id: calcifer-2e0a.13
title: Per-yak git worktrees + container-per-yak refactor
type: feature
priority: 2
created: '2026-05-04T02:12:17Z'
updated: '2026-05-04T02:19:12Z'
parent: calcifer-2e0a
---

Foundational structural change: replace the single shared workspace with a git worktree per active yak, and key containers by (project, yakId) instead of timestamp.

FILESYSTEM CHANGES:

  data/projects/{name}/
    config.yaml              # unchanged
    repo/                    # main git clone (replaces workspace/)
    worktrees/{yakId}/       # git worktree checkout, branch yak-{yakId}
    sessions/{yakId}/.claude # per-yak Claude SDK state
    context/                 # unchanged (project.json + CLAUDE.md supplement)
    ipc/                     # unchanged mount point
    logs/                    # unchanged

Migration: if workspace/ exists and repo/ does not, use workspace/ as repo/ (rename or symlink).

NEW FILE: src/worktree-manager.ts
  - ensureProjectRepo(project): clone repo into data/projects/{name}/repo/ if absent
  - createWorktree(project, yakId): git worktree add worktrees/{yakId} -b yak-{yakId}
    (if branch yak-{yakId} already exists, checkout it instead of creating fresh)
  - removeWorktree(project, yakId): git worktree remove worktrees/{yakId} --force
  - listActiveWorktrees(project): git worktree list --porcelain, return yakId-keyed map

CHANGES TO src/project-runner.ts:
  - Add projectRepoDir(name), projectWorktreeDir(name, yakId), projectYakSessionsDir(name, yakId)
  - buildProjectMounts: mount worktrees/{yakId} as /workspace/task (not workspace/)
  - mount sessions/{yakId}/.claude as /home/node/.claude (per-yak, not shared)
  - container name: nanoclaw-project-{safeName}-{safeYakId} (stable, not timestamp)
  - spawn mode: detached -d (not interactive -i); remove stdin/stdout marker parsing

CHANGES TO src/db/project-runs.ts:
  - Add lookup getActiveYakRun(projectName, yakId) -> project run or null
  - Container name field is now the stable yakId-based name

CHANGES TO src/project-manager.ts:
  - startProjectRun: if container nanoclaw-project-{name}-{yakId} is already running,
    route message in rather than spawning a new container
  - abandonProjectRun: removeWorktree after stopping container

CHANGES TO src/host-sweep.ts:
  - GC: for each project, find containers whose yak is shorn/abandoned; stop container + removeWorktree
  - Runs as part of the existing 60s sweep

DOES NOT INCLUDE: poll-loop / multi-turn IPC (that is 2e0a.14). This yak delivers the structural changes; 2e0a.14 adds interactive behavior on top.
