---
id: calcifer-d720.3
title: Tree/browser presentation (folder nav) + Documents library (first tree consumer)
type: task
priority: 2
created: '2026-08-15T15:26:09Z'
updated: '2026-08-15T15:32:59Z'
labels:
- skill-views
- seafile
- web-ui
---

---
▸ 2026-08-15T15:32:58Z
DONE+verified. ViewTree.tsx folder browser (breadcrumb, dirs-first rows, per-file open/download via byte endpoint, star toggle). App ViewIndex dispatches /app/:view to ViewTree or ViewList by manifest.presentation. api.ts fileUrl + browse/path params. ViewDetail gains Open/Download for non-prose fs files. Documents library (container/skills/seafile/views/documents.json, presentation=tree over Seafile/documents). Verified via authed API: browse root->nested dir, descend->16 items dirs-first with sizes.
