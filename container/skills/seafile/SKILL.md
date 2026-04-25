---
name: seafile
description: Seafile cloud storage — browse libraries, read/write/move/delete files, search, and share links. Use when the user wants to access, upload, or share files in cloud storage.
allowed-tools: mcp__seafile__*
env-guard: SEAFILE_TOKEN
---

# Seafile Cloud Storage

Access Seafile at https://files.j15r.com via MCP tools.

## Tools

**mcp__seafile__seafile_list_libraries** — List all accessible libraries (ID, name, size)

**mcp__seafile__seafile_list_dir** — List directory contents
- `library_id` (required), `path` (default: `/`)

**mcp__seafile__seafile_read_file** — Read file contents
- `library_id`, `path`

**mcp__seafile__seafile_upload_file** — Upload or update a file
- `library_id`, `path`, `content`, `replace` (default: false)

**mcp__seafile__seafile_create_dir** — Create a directory
- `library_id`, `path`

**mcp__seafile__seafile_delete** — Delete a file or directory
- `library_id`, `path`

**mcp__seafile__seafile_move** — Move or rename a file/directory
- `library_id`, `src_path`, `dst_path`

**mcp__seafile__seafile_search** — Search for files
- `query`, `library_id` (optional)

**mcp__seafile__seafile_create_share_link** — Create a shareable download link
- `library_id`, `path`, `password` (optional), `expire_days` (optional)

## Read vs. Share Links

Use **`seafile_read_file`** for text files you need to display or process (txt, md, csv, code).

Use **`seafile_create_share_link`** for images, PDFs, binary files, or when the user says "show me" a file — they click the link to view or download.

## Example

```
# List libraries
mcp__seafile__seafile_list_libraries()

# Browse a library
mcp__seafile__seafile_list_dir(library_id="abc123", path="/Documents")

# Read a file
mcp__seafile__seafile_read_file(library_id="abc123", path="/Documents/notes.txt")

# Upload
mcp__seafile__seafile_upload_file(library_id="abc123", path="/Documents/report.md", content="# Report\n...")

# Share link (e.g., for an image)
mcp__seafile__seafile_create_share_link(library_id="abc123", path="/photos/card.png")
```
