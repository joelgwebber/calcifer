---
id: calcifer-c4b7
title: 'Background agents can end their turn mid-wait on a backgrounded Bash poll, silently leaving work unfinished'
type: idea
priority: 3
created: '2026-08-24T18:30:00Z'
updated: '2026-08-24T18:30:00Z'
labels:
- agents
- orchestration
---

Observed live during the Seafile `notes`→wiki reorg: a background subagent
("Migrate notes/personal to joel-wiki", 194 files) hit a transient Seafile
502 outage on its last 3 files, launched a `run_in_background: true` Bash
poll to wait for recovery, said "I'll wait for this background poll to
signal recovery", and then ended its turn (`stop_reason: end_turn`) right
there.

Nothing resumed it. The orchestrator's task-notification later reported the
agent as "completed", with the `<result>` field just being that same stale
in-progress message — there was no signal distinguishing "actually
finished" from "gave up mid-wait". Only caught because the parent session
happened to re-check the raw output file instead of trusting the completion
summary. The 3 files sat uncopied and the source folder undeleted for
~12+ minutes until a human/parent-agent manually diffed source vs
destination and finished the job by hand.

**Risk:** subagents that background a long-running wait (Bash
`run_in_background`, sleep loops, etc.) and then emit an "I'll wait for X"
text can end their turn right there — they do NOT get automatically
re-invoked when the background command completes. The completion
notification for the *outer* Agent-tool task can still say "completed" even
though the inner work stalled, because the agent's own final message
becomes the reported result verbatim, with no verification that the
described condition was ever actually met.

**Ideas for a fix, roughly in order of leverage:**
1. Agent-authoring guidance (prompt-level, cheapest): tell agents explicitly
   not to background-and-end-turn on transient-failure retries; use a
   bounded foreground retry/poll instead (e.g.
   `timeout N bash -c 'until ...; do sleep 5; done'`) so the turn doesn't
   end until the real work resumes. Already applied ad hoc in a followup
   migration prompt this session — worth folding into general
   subagent-authoring guidance/skill if this pattern recurs.
2. Orchestration-level: detect when an agent's final message is
   speculative/future-tense ("I'll wait for...", "once X completes I
   will...") vs. a genuine completion summary, and either auto-resume the
   agent or flag the task as "stalled" rather than "completed".
3. Structured output: for tasks with a verifiable end state (e.g. "N files
   copied, source deleted"), have the agent report a structured completion
   assertion that the orchestrator can spot-check against reality before
   marking a task summary trustworthy.

No code changes made — this is a process/prompting gap, not a bug in a
specific tool. Filing so the pattern isn't lost; worth another look if it
recurs on a future multi-agent task.

(Note: filed by hand-writing this file directly — `container/tools/yaks/yak.py`,
the path documented in CLAUDE.local.md, does not exist anywhere in this
checkout; worth checking whether the yak CLI moved/was renamed during the
v2 rewrite.)
