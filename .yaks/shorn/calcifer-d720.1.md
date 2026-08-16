---
id: calcifer-d720.1
title: Manifest presentation dimension + fs browse mode (single-level dir+file listing)
type: task
priority: 2
created: '2026-08-15T15:26:09Z'
updated: '2026-08-15T15:32:58Z'
labels:
- skill-views
- seafile
parent: calcifer-d720
---

---
▸ 2026-08-15T15:32:58Z
DONE+verified. manifest.presentation ('list'|'tree', default list). fs browse mode: queryFs branches on params.browse to list one folder level (subdirs+files, dirs-first), containment on the browsed dir; flat recursive mode unchanged. Records gain kind ('dir'|'file'). recordFs only reads text-ext files (md/markdown/txt) as prose so a PDF/image never renders as garbage. Verified: browse root/subfolder, dirs-first, containment 400, flat total intact.
