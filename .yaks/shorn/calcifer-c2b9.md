---
id: calcifer-c2b9
title: Add a library skill for book collection
type: feature
priority: 2
created: '2026-04-21T01:31:18Z'
updated: '2026-04-21T18:42:31Z'
commit: fdcd1e4
---

Can be used with Hardcover to identify books to read, and pull them from the library.

### 2026-04-21T18:42:31Z
## Implementation (2026-04-21)

### What was built

**container/skills/library/SKILL.md** — new skill covering:
- Folder convention: one folder per book named `Author - Title/`, containing `book.*` + `metadata.yaml`
- YAML metadata schema: title, author, year, format, added, source, hardcover_id, tags, wiki_note
- Anna's Archive workflow: WebFetch search → user picks → curl download to /tmp → curl binary upload to Seafile (MCP upload_file only handles text, so raw Seafile HTTP API used directly with $SEAFILE_TOKEN)
- reMarkable send: curl download from Seafile → remarkable_upload_pdf (now also handles EPUB)
- reMarkable remove: remarkable_list → remarkable_delete
- Wiki stub: YAML frontmatter note at joel-wiki/books/Author - Title.md with seafile_path and hardcover_id
- Hardcover cross-reference: hardcover_search_books → update metadata.yaml with hardcover_id

**container/agent-runner/src/remarkable-mcp-stdio.ts** — extended remarkable_upload_pdf to detect .epub extension and send Content-Type: application/epub+zip. PDF still works as before. MOBI excluded (not natively supported by reMarkable).

**container/skills/remarkable/SKILL.md** — updated upload section to document EPUB support and drop the parent_id param mention (not implemented).

### Design decisions
- No new MCP server needed — Seafile + reMarkable MCPs already sufficient
- Binary uploads go via curl rather than extending the Seafile MCP (avoids base64 complexity for an ad-hoc workflow)
- Flat folder structure (no author nesting) — easier to browse and reference
- YAML for metadata (user preference over JSON)
- Human stays in the loop for Anna's Archive selection before download
