---
id: calcifer-0eae
title: Add global/shared container.json base config for common MCPs
type: feature
priority: 3
created: '2026-04-25T21:06:04Z'
updated: '2026-04-25T21:06:04Z'
---

v2 container.json is per-group with no inheritance. MCPs and credentials shared across all groups (e.g. seafile, readeck, workflowy, fastmail) must be duplicated in each group's container.json. Consider adding a groups/global/container.json (or similar) that gets merged with per-group config at container spawn time. This is v1's 'env stacking' equivalent. Low priority while only 2 groups exist; becomes important as more groups are added.
