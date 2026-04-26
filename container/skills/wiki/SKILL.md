---
name: wiki
description: Private personal wiki — use only for content that is personal or sensitive to one person (health records, finances, private contacts). For anything the family might care about, use the family-wiki skill instead.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, WebFetch, mcp__qmd__*, mcp__seafile__*
env-guard: SEAFILE_WIKI_LIBRARY
---

# Personal Wiki

Private wiki for one person. Files are synced from Seafile by the daemon — read and write them directly.

## Location

`/workspace/agent/joel-wiki/` (Joel) or `/workspace/agent/alicia-wiki/` (Alicia)

Organized however makes sense. Suggested top-level dirs: `vehicles/`, `property/`, `financial/`, `health/`, `people/`, `preferences/`, `documents/`. Add new ones freely.

## Search

```json
{
  "searches": [
    { "type": "lex", "query": "keyword" },
    { "type": "vec", "query": "natural language question" }
  ],
  "collections": ["joel"],
  "limit": 10
}
```

Use collection `joel` for Joel, `alicia` for Alicia.

## Reading and Writing

- Read files with Read/Glob/Grep as normal
- Write with Write/Edit — the Seafile daemon syncs changes to the cloud automatically

## Companion Extracts

Source files (PDFs, images) live alongside their `.md` extracts in the wiki directory. When you store a non-`.md` file, or when SCRIPT_DATA lists files needing extraction, always create a companion `.md` with the same base name:

- `research/some-paper.pdf` → `research/some-paper.md`
- `receipts/amazon-2026.jpg` → `receipts/amazon-2026.md`

### PDF

```bash
pdftotext /workspace/agent/joel-wiki/path/to/file.pdf -
```

If output has reasonable text (>50 words per page, no garbled characters): structure it into the companion `.md`.

If output is sparse or garbled (scanned/image PDF): use the Read tool on the PDF directly — Claude reads PDFs natively and can extract content from page images.

### Image (.png, .jpg, .jpeg, .gif, .webp, .tiff, .bmp)

Use the Read tool to view the image. Describe what's shown and transcribe any visible text verbatim.

### Companion `.md` format

```markdown
---
source: filename.ext
extracted: YYYY-MM-DD
---

# Title or Subject

[Extracted content...]
```
