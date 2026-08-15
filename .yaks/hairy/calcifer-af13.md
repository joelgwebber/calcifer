---
id: calcifer-af13
title: Revisit views security & access control (per-library scope/visibility)
type: idea
priority: 3
created: '2026-08-15T15:41:50Z'
updated: '2026-08-15T15:41:50Z'
labels:
- skill-views
- security
---

---
▸ 2026-08-15T15:41:50Z
Owner steer: keep it SIMPLE — family is highly trusting, everything is shared by default. Today: any authed web user (web:joel/web:alicia) sees every view; fs views have NO per-library scope; UI is public via Funnel :8443 (auth-gated). The seam exists (data.scope for sqlite; a per-library scope/allowlist could gate fs libraries like documents/taxes/wills). Revisit when reorganizing content; don't over-engineer.
