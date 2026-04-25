---
id: calcifer-c01f
title: Anna's Archive MCP integration
type: feature
priority: 2
created: '2026-04-22T02:56:38Z'
updated: '2026-04-22T03:17:09Z'
commit: 9adcf61
---

Integrate annas-mcp (https://github.com/iosifache/annas-mcp) into the library skill.

## What it is
- Go binary MCP server (prebuilt releases available)
- 4 tools: book_search, book_download, article_search, article_download
- book_search returns metadata + MD5 hash; book_download fetches by hash to ANNAS_DOWNLOAD_PATH
- Replaces the current WebFetch-scraping approach in the library skill

## Requirements
- Donor API key from Anna's Archive (ANNAS_SECRET_KEY env var)
- ANNAS_DOWNLOAD_PATH pointing to a writable container directory
- ANNAS_BASE_URL defaults to annas-archive.li (may need manual switching if mirror is down)

## Integration steps
1. Download binary and place it in the container (or bind-mount)
2. Add as MCP server in agent-runner alongside seafile/remarkable/hardcover
3. Update container/skills/library/SKILL.md to use mcp__annas__book_search / book_download instead of WebFetch + curl

## Status
Joel is setting up an annas-archive.gd account and getting the donor API key.
