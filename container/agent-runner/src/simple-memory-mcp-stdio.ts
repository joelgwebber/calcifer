/**
 * Simple Memory MCP Server
 * Provides lightweight memory storage using markdown files with YAML frontmatter
 *
 * Storage: /workspace/memory/{category}/{name}.md
 * Index: /workspace/memory/_index.json (auto-generated entity mapping)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const MEMORY_DIR = process.env.MEMORY_DIR || '/workspace/memory';
const INDEX_FILE = path.join(MEMORY_DIR, '_index.json');

const server = new McpServer({
  name: 'simple-memory',
  version: '1.0.0',
});

// Helper: Parse YAML frontmatter from markdown
function parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter: Record<string, any> = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      // Parse JSON arrays and objects
      if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'))) {
        try {
          frontmatter[key.trim()] = JSON.parse(value);
        } catch {
          // Fallback for YAML-style arrays without quotes: [family, daughter, emma]
          frontmatter[key.trim()] = JSON.parse(value.replace(/'/g, '"'));
        }
      } else {
        frontmatter[key.trim()] = value;
      }
    }
  }

  return { frontmatter, body: match[2] };
}

// Helper: Generate YAML frontmatter
function generateFrontmatter(tags: string[], created?: string, updated?: string): string {
  const now = new Date().toISOString();
  return `---
tags: ${JSON.stringify(tags)}
created: ${created || now}
updated: ${updated || now}
---

`;
}

// Helper: Update entity index
async function updateIndex(category: string, name: string, tags: string[]): Promise<void> {
  const filePath = `${category}/${name}.md`;
  let index: Record<string, string[]> = {};

  // Load existing index
  try {
    const indexContent = await fs.readFile(INDEX_FILE, 'utf-8');
    index = JSON.parse(indexContent);
  } catch {
    // Index doesn't exist yet
  }

  // Extract searchable terms from filename and tags
  const terms = new Set<string>();

  // Add filename (without extension)
  terms.add(name.toLowerCase());

  // Add individual words from filename
  const words = name.replace(/[-_]/g, ' ').toLowerCase().split(/\s+/);
  words.forEach(w => terms.add(w));

  // Add tags
  tags.forEach(t => terms.add(t.toLowerCase()));

  // Update index
  for (const term of terms) {
    if (!index[term]) {
      index[term] = [];
    }
    if (!index[term].includes(filePath)) {
      index[term].push(filePath);
    }
  }

  // Write index
  await fs.mkdir(MEMORY_DIR, { recursive: true });
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

// Helper: Load index
async function loadIndex(): Promise<Record<string, string[]>> {
  try {
    const content = await fs.readFile(INDEX_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// Tool: Save memory
server.tool(
  'memory_save',
  'Save information to long-term memory as a markdown file',
  {
    category: z.string().describe('Category folder (e.g., contacts, preferences, workflows)'),
    name: z.string().describe('Unique identifier for this memory (e.g., emma-webber, meeting-preferences)'),
    content: z.string().describe('Markdown content to store'),
    tags: z.array(z.string()).optional().describe('Tags for categorization'),
  },
  async (args) => {
    try {
      const category = args.category.replace(/[^a-z0-9-]/gi, '_');
      const name = args.name.replace(/[^a-z0-9-]/gi, '_');
      const tags = args.tags || [];

      const categoryDir = path.join(MEMORY_DIR, category);
      await fs.mkdir(categoryDir, { recursive: true });

      const filePath = path.join(categoryDir, `${name}.md`);

      // Check if file exists to preserve created date
      let created: string | undefined;
      try {
        const existing = await fs.readFile(filePath, 'utf-8');
        const { frontmatter } = parseFrontmatter(existing);
        created = frontmatter.created;
      } catch {
        // File doesn't exist yet
      }

      const frontmatter = generateFrontmatter(tags, created);
      const fullContent = frontmatter + args.content;

      await fs.writeFile(filePath, fullContent);
      await updateIndex(category, name, tags);

      return {
        content: [{
          type: 'text' as const,
          text: `Saved memory: ${category}/${name}.md\n${args.content.slice(0, 100)}${args.content.length > 100 ? '...' : ''}`
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get memory
server.tool(
  'memory_get',
  'Retrieve a specific memory by category and name',
  {
    category: z.string().describe('Category folder'),
    name: z.string().describe('Memory identifier'),
  },
  async (args) => {
    try {
      const category = args.category.replace(/[^a-z0-9-]/gi, '_');
      const name = args.name.replace(/[^a-z0-9-]/gi, '_');
      const filePath = path.join(MEMORY_DIR, category, `${name}.md`);

      console.error(`[simple-memory] memory_get: category="${args.category}" -> "${category}", name="${args.name}" -> "${name}"`);
      console.error(`[simple-memory] memory_get: attempting to read ${filePath}`);

      const content = await fs.readFile(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(content);

      console.error(`[simple-memory] memory_get: successfully read ${filePath}`);

      return {
        content: [{
          type: 'text' as const,
          text: `# ${category}/${name}\n\n**Tags:** ${frontmatter.tags?.join(', ') || 'none'}\n**Created:** ${frontmatter.created}\n**Updated:** ${frontmatter.updated}\n\n${body}`
        }],
      };
    } catch (err) {
      console.error(`[simple-memory] memory_get ERROR:`, err);
      return {
        content: [{ type: 'text' as const, text: `Memory not found: ${args.category}/${args.name}\nError: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// Tool: Search memories
server.tool(
  'memory_search',
  'Search across all memories using grep and entity index',
  {
    query: z.string().describe('Search query'),
    category: z.string().optional().describe('Limit search to specific category'),
  },
  async (args) => {
    try {
      const results: Array<{ file: string; snippet: string; matchType: string }> = [];

      // Step 1: Check entity index for exact/partial matches
      const index = await loadIndex();
      const queryLower = args.query.toLowerCase();
      const indexMatches: string[] = [];

      for (const [term, files] of Object.entries(index)) {
        if (term.includes(queryLower) || queryLower.includes(term)) {
          indexMatches.push(...files);
        }
      }

      // Deduplicate index matches
      const uniqueIndexMatches = [...new Set(indexMatches)];

      // Add index matches with high priority
      for (const file of uniqueIndexMatches) {
        const fullPath = path.join(MEMORY_DIR, file);
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const { body } = parseFrontmatter(content);
          results.push({
            file,
            snippet: body.slice(0, 150).replace(/\n/g, ' '),
            matchType: 'index'
          });
        } catch {
          // File might have been deleted
        }
      }

      // Step 2: Grep search for content matches
      const searchDir = args.category
        ? path.join(MEMORY_DIR, args.category.replace(/[^a-z0-9-]/gi, '_'))
        : MEMORY_DIR;

      try {
        const { stdout } = await execAsync(
          `grep -r -i -n "${args.query.replace(/"/g, '\\"')}" "${searchDir}" --include="*.md" 2>/dev/null || true`
        );

        if (stdout) {
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            const [filePath, ...rest] = line.split(':');
            if (!filePath || filePath === INDEX_FILE) continue;

            const relPath = path.relative(MEMORY_DIR, filePath);

            // Skip if already in index matches
            if (uniqueIndexMatches.includes(relPath)) continue;

            const snippet = rest.join(':').trim().slice(0, 150);
            results.push({
              file: relPath,
              snippet,
              matchType: 'content'
            });
          }
        }
      } catch {
        // Grep might fail if no matches
      }

      if (results.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `No memories found matching "${args.query}"` }],
        };
      }

      // Format results
      const formatted = results
        .map(r => `[${r.matchType}] ${r.file}\n  ${r.snippet}${r.snippet.length >= 150 ? '...' : ''}`)
        .join('\n\n');

      return {
        content: [{ type: 'text' as const, text: `Found ${results.length} memories:\n\n${formatted}` }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// Tool: List memories
server.tool(
  'memory_list',
  'List all memories, optionally filtered by category',
  {
    category: z.string().optional().describe('Category to list'),
  },
  async (args) => {
    try {
      const searchDir = args.category
        ? path.join(MEMORY_DIR, args.category.replace(/[^a-z0-9-]/gi, '_'))
        : MEMORY_DIR;

      const { stdout } = await execAsync(
        `find "${searchDir}" -name "*.md" -not -name "_*" 2>/dev/null | sort || true`
      );

      if (!stdout.trim()) {
        return {
          content: [{ type: 'text' as const, text: args.category ? `No memories in category "${args.category}"` : 'No memories stored yet' }],
        };
      }

      const files = stdout.trim().split('\n');
      const memories: string[] = [];

      for (const file of files) {
        const relPath = path.relative(MEMORY_DIR, file);
        try {
          const content = await fs.readFile(file, 'utf-8');
          const { frontmatter } = parseFrontmatter(content);
          const tags = frontmatter.tags?.join(', ') || 'no tags';
          const created = frontmatter.created || 'unknown';
          memories.push(`${relPath}\n  Tags: ${tags}\n  Created: ${created}`);
        } catch {
          memories.push(`${relPath}\n  (error reading file)`);
        }
      }

      return {
        content: [{ type: 'text' as const, text: `Memories (${memories.length} total):\n\n${memories.join('\n\n')}` }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// Start the stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
