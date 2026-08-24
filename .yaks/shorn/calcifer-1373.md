---
id: calcifer-1373
title: Document tree missing breadcrumbs on leaf nodes
type: bug
priority: 3
created: '2026-08-23T18:45:53Z'
updated: '2026-08-23T18:59:48Z'
parent: calcifer-7c3a
labels:
- ui
---

The document tree view has helpful nav breadcrumbs in the header. But when you open a markdown file from this UI, the only thing in the header is "<- [library-name]". It would be really helpful if breadcrumbs followed along with rendered files (like markdown).

---
▸ 2026-08-23T18:59:48Z
Added fs breadcrumb trail to ViewDetail header: Library root -> ancestor folders (link into the tree via ?path=) -> filename as non-clickable leaf. Gated on manifest.data.type==='fs'; non-fs record details keep the '<- Title' back link. New fsCrumbs() helper + .detail-crumbs CSS mirroring .tree-crumbs. web/src/views/ViewDetail.tsx, web/src/styles.css.
