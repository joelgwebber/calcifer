---
id: calcifer-d199.6.1
title: Wire family-wiki and personal wiki skills into agent containers
type: task
priority: 2
created: '2026-04-26T00:11:16Z'
updated: '2026-04-26T00:11:16Z'
---

Set up the two-wiki model so personal agents can use both private and shared family knowledge:

1. Seafile sync: add family-wiki library (bd209dd2-0c7b-4a4f-ac08-735f3182f6fa) to Seafile client sync list → /home/joel/Seafile/family-wiki/

2. dm-with-joel/container.json:
   - additionalMount: /home/joel/Seafile/family-wiki/ → /workspace/shared/family-wiki/ (rw)
   - env SEAFILE_SHARED_LIBRARY=bd209dd2-0c7b-4a4f-ac08-735f3182f6fa (activates family-wiki skill)
   - env SEAFILE_WIKI_LIBRARY=81e26dea-8b0c-48e3-b976-a211cd4356f1 (activates wiki skill)

3. Fix wiki skill path: container/skills/wiki/SKILL.md references /workspace/group/ (v1) — update to /workspace/agent/

4. dm-with-alicia/container.json: same additionalMount + SEAFILE_SHARED_LIBRARY once her alicia-wiki is populated

5. family group container.json (when created): additionalMount + SEAFILE_SHARED_LIBRARY only (no personal wiki)

6. QMD: configure to index /home/joel/Seafile/family-wiki/ and /home/joel/Seafile/joel-wiki/ — separate task, not blocking
