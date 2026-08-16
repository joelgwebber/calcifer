---
id: calcifer-2e0a.4
title: Task lifecycle and Calcifer triggering
type: feature
priority: 2
created: '2026-04-23T18:43:21Z'
updated: '2026-04-24T03:06:38Z'
parent: calcifer-2e0a
---

Wire up project agent task lifecycle: chat trigger → run → blocked → done.

TRIGGER:
  User message: 'work on gnusto yak gnusto-3a2f'
  → Calcifer parses project name + yak ID
  → Looks up projects/gnusto/config.yaml
  → Spins up project container
  → Sends 'started' confirmation

SQLITE TABLE: project_tasks
  id, project, yak_id, status, container_id, initiated_by_jid, started_at, updated_at, result_branch

STATES: queued → running → blocked → running → done / failed

STATUS QUERY:
  'what is gnusto working on?' → Calcifer replies with current yak + state

CONTROLS:
  'pause gnusto' / 'abandon gnusto task' → Calcifer kills container, updates status

COMPLETION:
  Agent pushes branch, writes completion IPC message
  Calcifer notifies initiating JID: '[gnusto] Done! Branch: feat/fix-reachability-loops'

UPSTREAM: Part of the add-project-agent skill.
