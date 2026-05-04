---
id: calcifer-eea7
title: Add NYT saved articles integration like Substack
type: feature
priority: 3
created: '2026-03-03T20:18:23Z'
updated: '2026-04-22T02:57:22Z'
---

Implement New York Times saved articles integration similar to the Substack saved articles feature, allowing reading and archival of NYT saved articles.

CONTEXT: Similar to calcifer-8045 (Substack saved articles), we want to access NYT saved articles programmatically for archival to Readeck and management.

RESEARCH FINDINGS:

NYT Official APIs:
- Archive API, Article Search API, Most Popular API, Top Stories API available
- Free developer account, 500 requests/day, 5 requests/minute rate limit
- APIs provide metadata only (headline, byline, date, keywords, URL)
- No full article content due to ToS restrictions
- NO public API for personal saved articles or reading lists

Personal Saved Articles Access:
- NYT does not provide a public API for accessing personal saved articles
- User-specific reading lists not available via official APIs
- Official APIs focus on published content discovery, not user account data

Implementation Options:

OPTION 1: Browser Cookie Authentication (Like Substack)
- Most likely approach to mirror Substack implementation
- Requires NYT login cookies for authentication
- Would need to reverse-engineer NYT's internal API endpoints
- Similar pattern to how Substack MCP works with cookies
- Risks: Unofficial, may break with NYT changes

Steps to investigate:
1. Inspect NYT saved articles page network requests (logged in)
2. Identify API endpoint for saved articles list
3. Determine authentication method (cookies, tokens)
4. Test with curl using exported cookies
5. Implement MCP server similar to substack-mcp-stdio.ts

OPTION 2: Browser Extension + Export
- Create Chrome/Firefox extension to export saved articles
- Export to JSON or CSV format
- Import into NanoClaw for processing
- Less real-time, more manual

OPTION 3: Web Scraping
- Use Playwright/Puppeteer to automate browser
- Log in and navigate to saved articles
- Extract article data from DOM
- More fragile, slower, higher maintenance
- Legal/ToS concerns

OPTION 4: Unofficial Third-Party APIs
- Some scraping services exist (Apify, Octoparse)
- Generally focused on published content, not user accounts
- May not support saved articles feature
- Cost and reliability concerns

RECOMMENDED APPROACH: Option 1 (Cookie Authentication)

Based on Substack success, implement similar cookie-based approach:
1. User provides NYT login cookies (NYT-S, NYT-T session cookies)
2. MCP server makes authenticated requests to NYT saved articles endpoint
3. Parse saved articles list (title, author, URL, date saved)
4. Provide tools similar to Substack MCP:
   - nyt_get_saved_articles(limit)
   - nyt_get_article(article_url) - fetch full content
   - nyt_remove_saved_article(article_id) - optional

IMPLEMENTATION PLAN:

Phase 1: Research & Reverse Engineering
1. Log into NYT and navigate to saved articles
2. Use browser DevTools to capture network requests
3. Identify saved articles API endpoint
4. Document request format, headers, cookies needed
5. Test with curl to verify cookie authentication works

Phase 2: MCP Server Implementation
1. Create src/nyt-mcp-stdio.ts based on substack-mcp-stdio.ts
2. Implement authentication with NYT cookies
3. Implement get_saved_articles tool
4. Implement get_article tool (fetch full article content)
5. Optional: implement remove_saved_article tool

Phase 3: Integration
1. Add NYT_COOKIES environment variable
2. Update MCP server list in config
3. Test with real NYT account
4. Document setup process (how to get cookies)

Phase 4: Workflow Integration
1. Create scheduled task to archive NYT articles to Readeck
2. Similar to Substack workflow: fetch saved → save to Readeck → remove from NYT
3. Tag articles appropriately in Readeck

DEPENDENCIES:
- Environment variables: NYT_S, NYT_T (or combined NYT_COOKIES)
- NPM packages: node-fetch, cheerio (for HTML parsing if needed)
- Similar to Substack MCP implementation

CHALLENGES:
- NYT may have different cookie/auth structure than Substack
- Article content may be harder to extract (paywall, complex layout)
- NYT may actively block scraping (Cloudflare, rate limiting)
- Cookie expiration and refresh handling
- Legal/ToS compliance concerns

SUCCESS CRITERIA:
- Can list saved articles from NYT account
- Can fetch full article content
- Can archive to Readeck with proper metadata
- Authentication via cookies works reliably
- Similar user experience to Substack workflow

REFERENCES:
- NYT Developer APIs: developer.nytimes.com
- NYT Article Search API: github.com/nytimes/public_api_specs
- Apify NYT Scraper: apify.com/theo/new-york-times-scraper
- Substack MCP implementation: /app/src/substack-mcp-stdio.ts (reference)

LEGAL CONSIDERATIONS:
- NYT ToS prohibit unauthorized scraping
- This is for personal use only (accessing your own saved articles)
- Similar to browser automation for personal account management
- Do not redistribute or commercialize

---
▸ 2026-04-21T17:51:52Z
## Research findings (2026-04-21)

### API endpoint confirmed
- GraphQL: GET https://samizdat-graphql.nytimes.com/graphql/v2
- Operation: YourListQuery (APQ persisted query, sha256Hash: baf36839d2052b17fce453a21ccf5bd8057d075730e848e9f0e61ec193daa5c5)
- Variables: {"first": N, "after": "<cursor>"} — cursor pagination
- Response: data.user.readingListAssetsConnection.{edges[].node, pageInfo.{hasNextPage, endCursor}, totalCount}
- Article fields: id, headline.default, url, firstPublished, bylines[].renderedRepresentation, summary
- saved_at is encoded in the base64 cursor (e.g. {"item_id":"nyt://article/...","saved_at":"2026-04-21 13:19:50"})

### Auth cookie
- NYT-S is the session token (equivalent to Substack's SID)
- Also useful: nyt-a, nyt-auth-method, nyt-purr, nyt-b-sid, nyt-jkidd

### Bot protection — hard blocker
- samizdat-graphql.nytimes.com is behind Fastly Bot Management Shield (error code 703)
- Blocks: curl, Python urllib/requests, Node.js fetch, curl-cffi with Chrome TLS impersonation (chrome110/116/120/124), HTTP/1.1
- www.nytimes.com/saved returns 200 but is a React SPA shell — no article data in HTML
- Article pages on www.nytimes.com also blocked (JS challenge page)
- The nyt-b-sid cookie is set by a Fastly JavaScript challenge and is bound to the browser session; replaying it from a different TLS client fails even with correct IP

### Recommended implementation
Bookmarklet approach:
1. JavaScript bookmarklet runs in user's real browser on any NYT page
2. Fetches all saved articles via GraphQL (works because real browser has proper TLS + nyt-b-sid)
3. POSTs JSON to NanoClaw HTTP API (localhost:3001) or downloads as nyt-saved.json
4. MCP server reads from /workspace/shared/nyt-saved.json (groups/shared/ is mounted there)

Bookmarklet core (expand to handle all pages via cursor pagination):
  fetch('https://samizdat-graphql.nytimes.com/graphql/v2?operationName=YourListQuery&variables=...&extensions=...', {credentials:'include'})

Still needed:
- Add /nyt-import endpoint to NanoClaw HTTP API (or just manual file drop)
- Write nyt-mcp-stdio.ts (reads from file, no API calls needed)
- Wire into index.ts + SKILL.md
