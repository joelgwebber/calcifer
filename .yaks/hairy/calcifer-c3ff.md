---
id: calcifer-c3ff
title: colleges.mjs validate doesn't check body-placed references
type: bug
priority: 3
created: '2026-08-23T14:19:05Z'
updated: '2026-08-23T14:19:05Z'
---

SKILL.md's Record format section says references belong in a body ## References section, but colleges.mjs validate (~line 271) still reads s.fm.references from frontmatter for url/tier checks. After moving Northeastern's references to the body per that guidance, those specific checks (missing url, invalid tier) silently no-op since fm.references is now empty. Low severity — validate still passes clean — but provenance checks are effectively disabled for any record following current guidance. Consider updating colleges.mjs to parse the body References section, or reconciling docs vs tool.
