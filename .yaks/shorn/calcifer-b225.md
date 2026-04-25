---
id: calcifer-b225
title: Add Hardcover reading tracker integration via GraphQL API
type: feature
priority: 2
created: '2026-03-01T19:41:51Z'
updated: '2026-04-21T18:00:12Z'
commit: 9b79180
---

Integrate Hardcover reading tracker (user migrated from StoryGraph). Hardcover has full GraphQL API unlike StoryGraph which has no API.

WHY HARDCOVER: User migrated from StoryGraph. Hardcover has official GraphQL API, real-time sync, better than scraping StoryGraph.

HARDCOVER API:
- Base: https://hardcover.app/api/graphql
- Auth: Bearer token in Authorization header
- GraphQL queries for: profile stats, currently reading, books read, to-read list, reading sessions
- Mutations for: update progress, add books

IMPLEMENTATION:
Create hardcover-mcp-stdio.ts similar to Substack MCP with tools:
- hardcover_get_profile - user stats and reading goal
- hardcover_get_currently_reading - active books with progress
- hardcover_get_books_read - finished books with ratings
- hardcover_get_to_read - TBR list
- hardcover_search_books - find books to add
- hardcover_add_book - add to list
- hardcover_update_progress - log pages read

SETUP:
- Get API token from hardcover.app account settings
- Store in HARDCOVER_API_TOKEN env var
- Use graphql-request npm package

USE CASES:
- Query: What am I reading? How many books this year?
- Update: I read 50 pages of current book
- Add: Add book to to-read list
- Schedule: Daily reading goal reminders, weekly summaries

PRIORITY P2: Official API available, user already migrated, similar effort to Substack integration.

Replaces previous StoryGraph research since StoryGraph has no API.
