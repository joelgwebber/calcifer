---
id: calcifer-7b34.2
title: 'Wiki polish: [[wikilinks]] + render frontmatter at top (instead of stripping)'
type: task
priority: 2
created: '2026-08-15T19:38:27Z'
updated: '2026-08-15T19:40:21Z'
labels:
- skill-views
- wiki
- web-ui
parent: calcifer-7b34
---

---
▸ 2026-08-15T19:40:21Z
DONE. ViewDetail: convertWikiLinks turns [[target]] / [[target|label]] into relative .md links (append .md if no ext), resolved by existing onNavigate -> in-view navigation. Frontmatter no longer stripped: splitFrontmatter + parseFrontmatter render it as a metadata header (dl, array values as badges) above the prose. Verified record API serves frontmatter + [[...]] raw; client transforms. Demo fixture added to family-wiki/test-calcifer.md (Seafile, not repo). Note: [[...]] resolves relative to current doc; global name-index resolution is a possible later enhancement.
