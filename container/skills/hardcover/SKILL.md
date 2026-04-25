---
name: hardcover
description: Hardcover reading tracker — view reading list, log progress, search and add books. Use when the user asks about books they're reading, have read, or want to read.
allowed-tools: mcp__hardcover__*
env-guard: HARDCOVER_API_TOKEN
---

# Hardcover Reading Tracker

Access and update the Hardcover reading list. Authentication uses `HARDCOVER_API_TOKEN` (auto-configured from environment).

## Setup (one-time)

1. Go to [hardcover.app/account/api](https://hardcover.app/account/api) and generate an API token.
2. Add to `.env`:
   ```
   HARDCOVER_API_TOKEN=your-token-here
   ```
3. Restart the service to apply.

## Tools

**mcp__hardcover__hardcover_get_profile** — Profile and stats
- Returns: username, total books read

**mcp__hardcover__hardcover_get_currently_reading** — Active books
- Returns: title, author, page progress (current/total), `user_book_id`

**mcp__hardcover__hardcover_get_books_read** — Finished books
- `limit` (default: 50, max: 200)
- Returns: title, author, year, user rating

**mcp__hardcover__hardcover_get_to_read** — TBR list
- `limit` (default: 50, max: 200)
- Returns: title, author, `book_id`, `user_book_id`

**mcp__hardcover__hardcover_search_books** — Find books
- `query`: title search string
- `limit` (default: 10, max: 20)
- Returns: title, author, year, pages, `book_id`

**mcp__hardcover__hardcover_add_book** — Add to list
- `book_id`: from `hardcover_search_books`
- `status`: `to_read` | `reading` | `read`

**mcp__hardcover__hardcover_update_progress** — Log pages read
- `user_book_id`: from `hardcover_get_currently_reading`
- `current_page`: page number reached

## Common workflows

**What am I reading?**
```
mcp__hardcover__hardcover_get_currently_reading()
```

**I read 80 more pages of my current book** — get the `user_book_id` first, then:
```
mcp__hardcover__hardcover_update_progress(user_book_id=42, current_page=230)
```

**Add a book to TBR**
```
mcp__hardcover__hardcover_search_books(query="Project Hail Mary")
# → get book_id from results
mcp__hardcover__hardcover_add_book(book_id=12345, status="to_read")
```

**How many books have I read this year?**
```
mcp__hardcover__hardcover_get_profile()
mcp__hardcover__hardcover_get_books_read(limit=200)
# Filter results by year if needed
```
