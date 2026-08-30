---
id: calcifer-2137
title: 'Provision family web accounts: Anaïs + Jay (match Alicia)'
type: task
priority: 2
created: '2026-08-30T00:57:58Z'
updated: '2026-08-30T01:03:22Z'
labels:
- ops,family
---

Add web:anais and web:jay accounts (password p4ssw0rt, role member), each with its own agent group (dm-with-anais, dm-with-jay) cloned from Alicia's config: seafile + readeck MCP, family-wiki RW mount, cli_scope group, skills all. Deliberately excludes Joel's personal MCP servers/mounts (fastmail/workflowy/substack/remarkable/annas/hardcover/fastmail-native, joel-wiki, projects, calcifer-project, nyc-apt). Web-only personas (trimmed CLAUDE.local.md, no WhatsApp/apartment bits).

---
▸ 2026-08-30T01:03:22Z
Done. Created agent groups dm-with-anais (ag-3d5cbd65-c0aa-404c-a990-a405d3069217) and dm-with-jay (ag-ce64578f-052e-4379-931f-4bdb125904c4), cloned Alicia's container config (seafile + readeck MCP, family-wiki RW mount, cli_scope group, skills all, assistant_name Calcifer) — excluded all of Joel's personal servers/mounts. Wrote trimmed web-only CLAUDE.local.md personas. Provisioned web:anais / web:jay (member, password p4ssw0rt) via the fixed web-user.ts; each has its own web:<handle> messaging group wired per-thread. Verified both authenticate via POST /api/login. Mount allowlist is root-based (/home/joel/Seafile RW) so no allowlist change needed. Group folders are gitignored (install-specific). Note: family also includes Lynn (per b258) — not requested, left alone.
