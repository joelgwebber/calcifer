---
id: calcifer-6ce5
title: 'Scaffold /admin operational skill: catalog of admin recipes (scripts + ncl)'
type: task
priority: 3
created: '2026-07-07T20:10:37Z'
updated: '2026-07-07T20:26:36Z'
labels:
- skills
---

No cookbook exists today for ad-hoc admin tasks (provision web user, q.ts queries, rewire mg, mint token, relocate shared skill data, close/inspect sessions, etc.). Create an instruction-only operational skill (.claude/skills/admin) indexing task->command, pointing at scripts/ + ncl. Follow CONTRIBUTING.md skill format. Seed with recipes used this session. Follow-up (later): graduate web-user.ts into an 'ncl web-users' resource.

---
▸ 2026-07-07T20:26:36Z
Done. Scaffolded .claude/skills/admin/SKILL.md — an instruction-only operational cookbook indexing host admin tasks -> commands (web users via scripts/web-user.ts, ad-hoc SQL via scripts/q.ts, session inspect/close, wiring via ncl, shared skill data + views, service restart, gotchas). Points at ncl + scripts/ as the two first-class surfaces. Noted the follow-up to graduate web-user.ts into an 'ncl web-users' resource.
