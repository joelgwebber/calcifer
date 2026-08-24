---
id: calcifer-cdef
title: Move markdown footer to the top/metadata area
type: task
priority: 3
created: '2026-08-23T18:48:40Z'
updated: '2026-08-23T18:59:48Z'
parent: calcifer-7c3a
---

It's kind of weird to see path/folder/modified/size in a footer at the bottom. To the extent we need this, we should put it at the top with the frontmatter/metadata. We can also simplify this a good bit -- path/folder are redundant, and we really don't need "size" for a markdown file.

---
▸ 2026-08-23T18:59:48Z
Replaced bottom detail-fields table for documents with a compact top .doc-meta line inside the .doc block. Shows only datetime-typed fields (Modified); path/kind/ext/size dropped — path is now covered by the 1373 breadcrumbs, size irrelevant for markdown. Bottom table still renders for structured (non-doc) records. web/src/views/ViewDetail.tsx, web/src/styles.css.
