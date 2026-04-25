---
name: readeck
description: Readeck bookmark manager — save, search, label, and archive web articles. Use when the user wants to save a URL for later, find a saved article, or manage their reading list.
allowed-tools: mcp__readeck__*
env-guard: READECK_API_KEY
---

# Readeck Bookmark Manager

Self-hosted bookmark manager that saves readable content of web pages.

## Tools

**mcp__readeck__readeck_create_bookmark** — Save a URL
- `url` (required), `tags` (optional array), `collection` (optional)

**mcp__readeck__readeck_list_bookmarks** — List bookmarks
- `page`, `limit` (default: 20), `archived` (true=archived only / false=unarchived only), `search`

**mcp__readeck__readeck_get_bookmark** — Get full bookmark details
- `id`

**mcp__readeck__readeck_search** — Search by keyword (titles, content, URLs)
- `query`, `limit` (default: 20)

**mcp__readeck__readeck_list_labels** — List available labels
- `query` (optional filter)

**mcp__readeck__readeck_update_bookmark** — Add/remove labels
- `id`, `add_labels` (comma-separated), `remove_labels` (comma-separated)

**mcp__readeck__readeck_mark_favorite** — Mark/unmark favorite
- `id`, `favorite` (boolean)

**mcp__readeck__readeck_update_read_progress** — Update reading progress (0–100)
- `id`, `progress`

**mcp__readeck__readeck_update_status** — Archive/unarchive
- `id`, `archived` (boolean)

**mcp__readeck__readeck_delete_bookmark** — Delete permanently
- `id`

## Example

```
# Save a bookmark
mcp__readeck__readeck_create_bookmark(url="https://example.com/article", tags=["tech", "tutorial"])

# Search
mcp__readeck__readeck_search(query="python")

# Mark as read
mcp__readeck__readeck_update_read_progress(id="abc123", progress=100)

# Archive
mcp__readeck__readeck_update_status(id="abc123", archived=true)
```
