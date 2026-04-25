---
id: calcifer-mem1
title: Fix simple-memory YAML frontmatter parsing
type: bug
priority: 2
created: '2026-03-14T18:52:00Z'
updated: '2026-03-14T21:46:00Z'
commit: 42a6dae
---

Simple memory files were saved with malformed YAML frontmatter that couldn't be parsed.

## Root Cause

**Serialization mismatch**: Tags were saved as YAML-style arrays `[family, daughter, emma]` (unquoted) but parsed as JSON expecting `["family","daughter","emma"]` (quoted).

```typescript
// BROKEN: generateFrontmatter() wrote unquoted values
tags: [${tags.map(t => `${t}`).join(', ')}]
// Output: tags: [family, daughter, emma]

// parseFrontmatter() expected JSON format
JSON.parse(value.replace(/'/g, '"'))
// Failed on: [family, daughter, emma] (invalid JSON)
```

## Fix

1. **Updated generateFrontmatter()** to use `JSON.stringify(tags)`:
   - Now outputs: `tags: ["family","daughter","emma"]`

2. **Updated parseFrontmatter()** with try/catch fallback:
   - First tries native JSON parsing (proper double-quoted arrays)
   - Falls back to single-quote replacement for YAML-style arrays

3. **Fixed existing memory files** to use proper JSON format:
   - Updated all 4 contact files in data/sessions/main/memory/contacts/
   - Changed from `[family, ...]` to `["family",...]`

## Files Changed

- `container/agent-runner/src/simple-memory-mcp-stdio.ts`: Fixed frontmatter generation and parsing
- `data/sessions/main/memory/contacts/*.md`: Fixed tags format in 4 existing files

## Testing

After fix:
```typescript
memory_get(category="contacts", name="emma-webber")  // ✅ Works
```

## Related

- Replaced memory-kernel with simple-memory in commit 7602eb9
- MCP server config: container/agent-runner/src/index.ts:438-445
