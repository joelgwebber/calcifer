---
id: calcifer-f432
title: Revisit semantic search across wiki and conversation skills
type: feature
priority: 3
created: '2026-04-26T00:53:13Z'
updated: '2026-04-26T00:53:13Z'
---

We removed QMD from wiki/family-wiki skills in favor of Seafile text search. QMD (or a replacement) should come back once we decide on the right approach.

CONTEXT:
- QMD was installed via add-karpathy-llm-wiki skill; runs as HTTP MCP server at port 8182
- Agent runner only supports stdio MCP servers — no url field in McpServerConfig
- Adding HTTP MCP support to agent runner is ~1hr of work and would be generally useful
- Seafile MCP has seafile_search (keyword only) as interim replacement
- QMD supported lex + vec (semantic) queries; good for wiki search and conversation history

OPTIONS:
1. Add HTTP MCP server support to agent runner (url field + SSE/HTTP transport in Claude provider)
2. Run QMD as stdio MCP proxy inside container
3. Different semantic search tool entirely

SCOPE:
- wiki skill
- family-wiki skill
- qmd skill (currently dormant)
- possibly conversation search too
