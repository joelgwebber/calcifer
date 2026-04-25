---
name: substack
description: Substack saved articles — read and manage your Substack reading list. Use when the user wants to see saved Substack articles or move them to Readeck.
allowed-tools: mcp__substack__*
env-guard: SUBSTACK_SID
---

# Substack Saved Articles

Access your Substack reading list. Authentication uses `SUBSTACK_SID` and `SUBSTACK_LLI` cookies (auto-configured from environment).

## Tools

**mcp__substack__substack_get_saved_articles** — Get saved articles
- `limit` (default: 20, max: 100)
- Returns: title, author, publication, URL, engagement stats — sorted newest first

**mcp__substack__substack_get_article** — Get full article content as markdown
- `subdomain` (e.g., "platformer"), `slug` (e.g., "my-article-title")
- Handles paid content automatically if subscribed

**mcp__substack__substack_remove_saved_article** — Remove from saved list
- `post_id` (from saved articles list)

## Workflow: Archive to Readeck

A common pattern for keeping the Substack inbox clean:

1. `substack_get_saved_articles` — list saved articles
2. For each: `substack_get_article` to get full content
3. `mcp__readeck__readeck_create_bookmark` to save to Readeck
4. `substack_remove_saved_article` to remove from Substack

## Example

```
# List saved articles
mcp__substack__substack_get_saved_articles(limit=50)

# Read full article
mcp__substack__substack_get_article(subdomain="platformer", slug="the-article-slug")

# Remove after archiving
mcp__substack__substack_remove_saved_article(post_id=187132686)
```
