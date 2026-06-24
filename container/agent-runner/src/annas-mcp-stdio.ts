/**
 * Anna's Archive MCP Server
 * Search: HTML scraping via cheerio
 * Download: /dyn/api/fast_download.json (donor API key required)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';

const BASE_URL = (process.env.ANNAS_BASE_URL || 'https://annas-archive.gd').replace(/\/$/, '');
const SECRET_KEY = process.env.ANNAS_SECRET_KEY;
const DOWNLOAD_PATH = process.env.ANNAS_DOWNLOAD_PATH || '/tmp';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function httpGet(url: string): Promise<Response> {
  return fetch(url, { headers: { 'User-Agent': UA } });
}

interface BookResult {
  md5: string;
  title: string;
  author: string;
  format: string;
  size: string;
  year: string;
  language: string;
}

function parseSearchResults(html: string): BookResult[] {
  const $ = cheerio.load(html);
  const results: BookResult[] = [];

  $('a[href^="/md5/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const md5 = href.match(/\/md5\/([a-f0-9]+)/i)?.[1];
    if (!md5) return;

    // Skip duplicate md5s (navigation links sometimes repeat)
    if (results.some(r => r.md5 === md5)) return;

    const text = $(el).text().replace(/\s+/g, ' ').trim();

    const format = text.match(/\b(epub|pdf|djvu|mobi|fb2|cbz|azw3)\b/i)?.[1]?.toLowerCase() ?? '';
    const size = text.match(/\b(\d+(?:\.\d+)?\s*(?:KB|MB|GB))\b/i)?.[1] ?? '';
    const year = text.match(/\b(1[0-9]{3}|20[0-9]{2})\b/)?.[1] ?? '';

    // Language: look for bracketed language or common language names
    const language = text.match(/\b(English|French|German|Spanish|Russian|Chinese|Japanese|Italian|Portuguese|Dutch)\b/i)?.[1] ?? '';

    // Title: the link title attribute, or first meaningful text chunk
    const titleAttr = $(el).attr('title');
    // Try to get title from the visible name div (Anna's Archive uses h3 or prominent text)
    const h3 = $(el).find('h3').first().text().trim();
    const titleDiv = $(el).find('.truncate, [class*="font-bold"], [class*="text-lg"]').first().text().trim();
    const title = titleAttr || h3 || titleDiv || text.split(/[|\n]/)[0].trim();

    // Author: look for a secondary text element or parse after title
    const authorDiv = $(el).find('[class*="italic"], [class*="author"]').first().text().trim();
    const author = authorDiv || '';

    results.push({ md5, title, author, format, size, year, language });
  });

  return results;
}

const server = new McpServer({ name: 'annas', version: '1.0.0' });

server.tool(
  'annas_search_books',
  'Search Anna\'s Archive for books by title, author, or topic. Returns results with MD5 hashes needed for download.',
  {
    query: z.string().describe('Search query — title, author, or topic'),
    format: z.enum(['epub', 'pdf', 'any']).optional().describe('Format filter (default: any)'),
  },
  async (args) => {
    const params = new URLSearchParams({ q: args.query, lang: 'en' });
    if (args.format && args.format !== 'any') params.set('ext', args.format);

    const resp = await httpGet(`${BASE_URL}/search?${params}`);
    if (!resp.ok) throw new Error(`Search request failed (${resp.status})`);

    const results = parseSearchResults(await resp.text());
    if (results.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No results found.' }] };
    }

    const formatted = results.slice(0, 20).map((r, i) => {
      const meta = [r.format, r.size, r.language, r.year].filter(Boolean).join('  ');
      return `${i + 1}. ${r.title}${r.author ? `\n   by ${r.author}` : ''}\n   ${meta}\n   MD5: ${r.md5}`;
    }).join('\n\n');

    return {
      content: [{ type: 'text' as const, text: `${results.length} result(s):\n\n${formatted}` }],
    };
  },
);

server.tool(
  'annas_download_book',
  'Download a book from Anna\'s Archive using its MD5 hash. Returns the local file path.',
  {
    md5: z.string().describe('MD5 hash from annas_search_books'),
    filename: z.string().describe('Output filename with extension, e.g. "book.epub"'),
  },
  async (args) => {
    if (!SECRET_KEY) throw new Error('ANNAS_SECRET_KEY not set — donor API key required');

    const apiUrl = `${BASE_URL}/dyn/api/fast_download.json?md5=${args.md5}&key=${SECRET_KEY}`;
    const apiResp = await httpGet(apiUrl);
    if (!apiResp.ok) throw new Error(`Fast download API failed (${apiResp.status}): ${await apiResp.text()}`);

    const result = await apiResp.json() as { download_url?: string; error?: string };
    if (result.error) throw new Error(`Download API error: ${result.error}`);
    if (!result.download_url) throw new Error('No download URL in API response');

    const fileResp = await fetch(result.download_url, { headers: { 'User-Agent': UA } });
    if (!fileResp.ok) throw new Error(`File download failed (${fileResp.status})`);

    await fs.mkdir(DOWNLOAD_PATH, { recursive: true });
    const outPath = path.join(DOWNLOAD_PATH, args.filename);
    const buf = Buffer.from(await fileResp.arrayBuffer());
    await fs.writeFile(outPath, buf);

    const sizeMB = (buf.length / 1024 / 1024).toFixed(2);
    return {
      content: [{ type: 'text' as const, text: `Downloaded to ${outPath} (${sizeMB} MB)` }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
