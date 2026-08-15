---
id: calcifer-7b34.1
title: fs view byte-serving endpoint (raw file bytes, contained + authed)
type: task
priority: 2
created: '2026-08-15T15:08:43Z'
updated: '2026-08-15T15:12:26Z'
labels:
- skill-views
- web-ui
---

---
▸ 2026-08-15T15:12:26Z
DONE + verified. fs views now byte-serve any contained file: data-plane readViewFile/readFileFs (serves ANY file under root, not just record exts; realpath containment), web-views fileForUser, web.ts GET /api/views/:view/file/(.+) streaming with Content-Type-by-ext, Content-Length, Content-Disposition (inline | attachment via ?download=1), auth-required. Prose primitive gains resolveAsset: relative <img src> and non-.md links resolve to the byte endpoint (source-agnostic; context owns bytes). Verified: PDF inline 200 (type/len/%PDF bytes), ?download=1 attachment, .md as text/markdown, traversal 400, no-cookie 401.
