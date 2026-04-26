---
name: family-wiki
description: Default wiki for most things — shared family knowledge base covering schedules, travel, household, contacts, and shared documents. Use this unless the content is explicitly personal or sensitive to one person.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, WebFetch, mcp__seafile__*
env-guard: SEAFILE_SHARED_LIBRARY
---

# Family Wiki

Default wiki for shared family knowledge. Files are synced from a shared Seafile library by the daemon — all family agents read and write the same files.

## Location

`/workspace/extra/shared/family-wiki/`

Organized however makes sense. Suggested top-level dirs: `people/`, `travel/`, `household/`, `schedules/`, `documents/`. Add new ones freely.

## Search

Use `mcp__seafile__seafile_search` for keyword search across family wiki files. Optionally scope to the family wiki library ID (available as `SEAFILE_SHARED_LIBRARY` in env).

For broader file discovery, use Glob/Grep directly on the wiki directory.

## Reading and Writing

- Read and write files directly — the Seafile daemon syncs changes automatically
- Changes made by one family agent are visible to all others once the daemon syncs (typically seconds)

## Companion Extracts

Source files (PDFs, images) live alongside their `.md` extracts. When you store a non-`.md` file, or when SCRIPT_DATA lists files needing extraction, always create a companion `.md` with the same base name:

- `documents/insurance-card.pdf` → `documents/insurance-card.md`
- `travel/hotel-confirmation.png` → `travel/hotel-confirmation.png.md`

### PDF

```bash
pdftotext /workspace/extra/shared/family-wiki/path/to/file.pdf -
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
