---
id: calcifer-705c
title: Broken wiki links in web ui
type: bug
priority: 1
created: '2026-08-25T03:40:40Z'
updated: '2026-08-25T23:16:31Z'
parent: calcifer-2520
labels:
- web-ui
---

There seem to be a lot of broken links in the wiki rendering. For example, https://calcifer.j15r.com/app/family-wiki/family%2FAlicia%2FAlicia.md has a link to "Will" under "Estate Documents" that links to: https://calcifer.j15r.com/api/views/family-wiki/file/financial%2Festate%2Fwills-and-directives%2FAlicia%2520-%2520Executed%2520copy%2520of%2520Will%25208-19-2024.pdf

This document doesn't resolve to anything but `{"error":"file not found"}`.

---
▸ 2026-08-25T23:16:31Z
Fixed: markdown/wiki link destinations are percent-encoded per CommonMark (a file with spaces arrives as A%20B.pdf), but resolveDocPath() preserved the raw segments and then resolveAsset()/onNavigate() ran encodeURIComponent again → %2520. Server decodes the byte-endpoint path exactly once (web.ts), so the double-encoded space never resolved (404 file-not-found). resolveDocPath now decodes each href segment (safe try/catch) and returns a real logical path; callers encode once. Verified live on the authed app: new single-%20 URL → 200 application/pdf; old %2520 → 404. Also fixes internal .md nav with spaces. web/src/views/ViewDetail.tsx.
