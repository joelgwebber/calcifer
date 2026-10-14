/**
 * Anna's Archive MCP Server
 *
 * Search: driven through a real, persistent-profile Chromium via playwright-core.
 *   Anna's Archive mirrors sit behind DDoS-Guard. Its /search wall escalates past
 *   the JS auto-check to a *manual image CAPTCHA*, so a plain fetch + cheerio
 *   scrape can never clear it (calcifer-0e32). Instead we run search in a real
 *   browser with a persistent cookie jar. When the wall appears we surface the
 *   CAPTCHA image to the agent, which either reads it itself (vision) or relays it
 *   to the user, then calls annas_solve_captcha. Once solved, DDoS-Guard's __ddg*
 *   cookies persist in the profile and later searches ride them until they expire.
 *
 *   The MCP server owns the browser and the mechanical steps (navigate, click the
 *   checkbox, read the CAPTCHA image, submit, parse results). The agent is the
 *   vision / human bridge — it cannot see this process's browser, so the CAPTCHA
 *   is handed out as an inline image (and saved to a PNG for relaying to a human).
 *
 * Download: /dyn/api/fast_download.json (donor API key required) — plain fetch.
 *   Not currently browser-driven; the donor API may not be DDoS-Guard-walled the
 *   way /search is. Revisit if downloads start failing (calcifer-0e32).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import { z } from 'zod';

// ANNAS_BASE_URL may be a single URL or a comma-separated candidate list. Mirrors
// are tried in order; the first that loads (a real page or a CAPTCHA wall, either
// counts as "reachable") is remembered for the rest of the session. Dead mirrors
// (DNS failure, 502, timeout) are skipped.
const MIRRORS = (process.env.ANNAS_BASE_URL || 'https://annas-archive.gl,https://annas-archive.gd')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

const SECRET_KEY = process.env.ANNAS_SECRET_KEY;
const DOWNLOAD_PATH = process.env.ANNAS_DOWNLOAD_PATH || '/tmp';
// Persistent Chromium profile — the DDoS-Guard cookie jar lives here so a CAPTCHA
// solved once is reused by later searches. Default /tmp survives across searches
// within one container; point ANNAS_PROFILE_DIR at a mounted host path for
// cross-session persistence (calcifer-d902).
const PROFILE_DIR = process.env.ANNAS_PROFILE_DIR || '/tmp/annas-browser-profile';
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
const CAPTCHA_PNG = path.join(DOWNLOAD_PATH, 'annas-captcha.png');

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function log(msg: string): void {
  console.error(`[annas-mcp] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Browser lifecycle -------------------------------------------------------

let context: BrowserContext | null = null;
let currentPage: Page | null = null;
let workingBase: string | null = null;
// The search that stalled on a CAPTCHA, awaiting annas_solve_captcha.
let pending: { query: string; format?: string } | null = null;

async function ensureBrowser(): Promise<Page> {
  if (context && currentPage && !currentPage.isClosed()) return currentPage;
  await fs.mkdir(PROFILE_DIR, { recursive: true });
  log(`launching Chromium (profile: ${PROFILE_DIR}, exe: ${CHROMIUM_PATH ?? 'bundled'})`);
  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    executablePath: CHROMIUM_PATH,
    viewport: { width: 1280, height: 900 },
    userAgent: UA,
    locale: 'en-US',
    // --no-sandbox: the image drops setuid and runs as an unprivileged user, so
    // Chromium's sandbox can't initialise. The container is the isolation boundary.
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  currentPage = context.pages()[0] ?? (await context.newPage());
  return currentPage;
}

async function closeBrowser(): Promise<void> {
  try {
    await context?.close();
  } catch {
    /* best effort */
  }
  context = null;
  currentPage = null;
}

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    void closeBrowser().finally(() => process.exit(0));
  });
}

// ---- Page-state probes -------------------------------------------------------

function searchUrl(base: string, query: string, format?: string): string {
  const params = new URLSearchParams({ q: query, lang: 'en' });
  if (format && format !== 'any') params.set('ext', format);
  return `${base}/search?${params}`;
}

async function hasResults(page: Page): Promise<boolean> {
  try {
    return (await page.locator('a[href^="/md5/"]').count()) > 0;
  } catch {
    return false;
  }
}

// The manual CAPTCHA lives in the #ddg-iframe srcdoc; its presence is the only
// reliable wall signal. (The `check=1` URL param and the "DDOS-GUARD" title both
// persist on the *passed* results page, and the auto-check interstitial shows the
// same title while it resolves on its own — so neither can distinguish a wall.)
async function isCaptchaWall(page: Page): Promise<boolean> {
  try {
    return (await page.locator('#ddg-iframe').count()) > 0;
  } catch {
    return false;
  }
}

/**
 * Poll until the page resolves into results or the manual CAPTCHA. DDoS-Guard's
 * no-interaction auto-check ("Checking your browser … opens automatically") shows
 * neither, so we keep waiting through it until it either lands on results or
 * escalates to the #ddg-iframe checkbox.
 */
async function waitForOutcome(page: Page, ms = 30000): Promise<'results' | 'captcha' | 'unknown'> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await hasResults(page)) return 'results';
    if (await isCaptchaWall(page)) return 'captcha';
    await sleep(750);
  }
  if (await hasResults(page)) return 'results';
  if (await isCaptchaWall(page)) return 'captcha';
  return 'unknown';
}

// ---- CAPTCHA handling --------------------------------------------------------
// The DDoS-Guard challenge lives in a same-origin srcdoc iframe (#ddg-iframe):
//   .ddg-captcha__checkbox   — "I'm not a robot" checkbox (reveals the modal)
//   .ddg-modal__captcha-image — distorted-text image (a data: URL PNG)
//   .ddg-modal__input        — text field
//   .ddg-modal__submit       — "Verify" button

/** Open the CAPTCHA modal if needed and return the image as a data: URL, or null. */
async function readCaptchaImage(page: Page): Promise<string | null> {
  const frame = page.frameLocator('#ddg-iframe');
  const img = frame.locator('.ddg-modal__captcha-image');

  const alreadyVisible = await img.isVisible().catch(() => false);
  if (!alreadyVisible) {
    // Clicking the checkbox reveals the image modal (and, on a clean fingerprint,
    // may instead just pass the check — the caller re-checks hasResults after).
    await frame
      .locator('.ddg-captcha__checkbox')
      .click({ timeout: 15000 })
      .catch(() => {});
  }

  try {
    await img.waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    return null;
  }
  const src = await img.getAttribute('src').catch(() => null);
  return src && src.startsWith('data:image') ? src : null;
}

async function submitCaptcha(page: Page, answer: string): Promise<void> {
  const frame = page.frameLocator('#ddg-iframe');
  await frame.locator('.ddg-modal__input').fill(answer, { timeout: 10000 });
  await frame.locator('.ddg-modal__submit').click({ timeout: 10000 });
}

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/\w+;base64,/, '');
}

async function saveCaptchaPng(dataUrl: string): Promise<void> {
  try {
    await fs.mkdir(DOWNLOAD_PATH, { recursive: true });
    await fs.writeFile(CAPTCHA_PNG, Buffer.from(dataUrlToBase64(dataUrl), 'base64'));
  } catch (e) {
    log(`could not save CAPTCHA PNG: ${e}`);
  }
}

type ToolContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

function textResult(text: string, isError = false) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError: true } : {}) };
}

/**
 * The captcha_required response: inline image (for the agent's own vision) plus a
 * saved PNG path (for relaying to a human) plus instructions. Same shape whether
 * it's the first challenge or a retry after a rejected answer.
 */
function captchaRequiredResult(dataUrl: string, preamble?: string) {
  const content: ToolContent[] = [
    {
      type: 'text',
      text:
        (preamble ? `${preamble}\n\n` : '') +
        'DDoS-Guard is blocking search with a CAPTCHA. Read the distorted characters in ' +
        'the image below.\n\n' +
        '- If you can read them confidently, call annas_solve_captcha with { answer: "<text>" }.\n' +
        '- If you cannot, show the image to the user (also saved at ' +
        CAPTCHA_PNG +
        ') and ask them to type exactly what they see, then call annas_solve_captcha with their answer.\n\n' +
        'The search resumes automatically once the answer is accepted.',
    },
    { type: 'image', data: dataUrlToBase64(dataUrl), mimeType: 'image/png' },
  ];
  return { content };
}

// ---- Result parsing (unchanged scrape of the results HTML) -------------------

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
  // Anna's Archive server-renders each result row *inside an HTML comment* and
  // un-comments it via JS on scroll (a first-paint optimisation). cheerio does
  // not descend into comment nodes, so strip the comment markers first — the
  // rows are all present in the source, just wrapped.
  const uncommented = html.split('<!--').join('').split('-->').join('');
  const $ = cheerio.load(uncommented);

  // Drop the header's "recent downloads" ticker — its md5 links are on every page
  // and are not results (this was the old parser's bug: it returned the ticker).
  $('.js-recent-downloads-container, .js-recent-downloads-scroll').remove();

  const results: BookResult[] = [];
  const seen = new Set<string>();

  // Each result has two md5 anchors: a cover-image link (no text) and the title
  // link (the text-bearing one). Key off the title link.
  $('a[href^="/md5/"]').each((_, el) => {
    const $a = $(el);
    const title = $a.text().replace(/\s+/g, ' ').trim();
    if (!title) return; // cover-image link

    const href = $a.attr('href') ?? '';
    const md5 = href.match(/\/md5\/([a-f0-9]+)/i)?.[1];
    if (!md5 || seen.has(md5)) return;
    seen.add(md5);

    // The text column around the title holds: a font-mono source-path line (with
    // the file extension), then author + publisher/series/year as /search links.
    const col = $a.parent();
    const colText = col.text().replace(/\s+/g, ' ').trim();
    const pathText = col.find('.font-mono').first().text();

    const format = (
      pathText.match(/\.(epub|pdf|djvu|mobi|fb2|cbz|azw3)\b/i)?.[1] ||
      colText.match(/\b(epub|pdf|djvu|mobi|fb2|cbz|azw3)\b/i)?.[1] ||
      ''
    ).toLowerCase();
    const size = colText.match(/\b(\d+(?:\.\d+)?\s*(?:KB|MB|GB))\b/i)?.[1] ?? '';
    const language =
      colText.match(
        /\b(English|French|German|Spanish|Russian|Chinese|Japanese|Italian|Portuguese|Dutch)\b/i,
      )?.[1] ?? '';

    // Author + publisher/series/year live in the /search?q= links (first = author,
    // rest = publisher/series line). Read the year from those bibliographic lines
    // rather than colText, so the source-path's collection year doesn't win.
    let author = '';
    const metaParts: string[] = [];
    col.find('a[href^="/search?q="]').each((_, a) => {
      const t = $(a).text().replace(/\s+/g, ' ').trim();
      if (!t) return;
      if (!author) author = t;
      metaParts.push(t);
    });
    const year =
      metaParts.join('  ').match(/\b(1[0-9]{3}|20[0-9]{2})\b/)?.[1] ??
      colText.match(/\b(1[0-9]{3}|20[0-9]{2})\b/)?.[1] ??
      '';

    results.push({ md5, title, author, format, size, year, language });
  });

  return results;
}

function formatResults(html: string) {
  const results = parseSearchResults(html);
  if (results.length === 0) {
    return textResult('No results found.');
  }
  const formatted = results
    .slice(0, 20)
    .map((r, i) => {
      const meta = [r.format, r.size, r.language, r.year].filter(Boolean).join('  ');
      return `${i + 1}. ${r.title}${r.author ? `\n   by ${r.author}` : ''}\n   ${meta}\n   MD5: ${r.md5}`;
    })
    .join('\n\n');
  return textResult(`${results.length} result(s):\n\n${formatted}`);
}

// ---- Tools -------------------------------------------------------------------

const server = new McpServer({ name: 'annas', version: '2.0.0' });

server.tool(
  'annas_search_books',
  "Search Anna's Archive for books by title, author, or topic. Returns results with MD5 hashes needed for download. Runs in a real browser behind DDoS-Guard; if a CAPTCHA blocks results it returns the CAPTCHA image and instructions — read it (or ask the user) and continue with annas_solve_captcha.",
  {
    query: z.string().describe('Search query — title, author, or topic'),
    format: z.enum(['epub', 'pdf', 'any']).optional().describe('Format filter (default: any)'),
  },
  async (args) => {
    let page: Page;
    try {
      page = await ensureBrowser();
    } catch (e) {
      return textResult(
        `Could not launch the browser for search: ${e instanceof Error ? e.message : String(e)}`,
        true,
      );
    }

    // Try mirrors in order; remember the first that loads.
    const order = workingBase ? [workingBase, ...MIRRORS.filter((m) => m !== workingBase)] : MIRRORS;
    let navigated = false;
    let lastErr: unknown;
    for (const base of order) {
      try {
        await page.goto(searchUrl(base, args.query, args.format), {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        workingBase = base;
        navigated = true;
        log(`search "${args.query}" via ${base}`);
        break;
      } catch (e) {
        lastErr = e;
        log(`mirror failed: ${base} (${e})`);
      }
    }
    if (!navigated) {
      return textResult(
        `All mirrors failed to load (${order.join(', ')}). Last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
        true,
      );
    }

    const outcome = await waitForOutcome(page);
    if (outcome === 'results') return formatResults(await page.content());

    if (outcome === 'captcha') {
      const dataUrl = await readCaptchaImage(page);
      // Clicking the checkbox may have simply passed the check.
      if (await hasResults(page)) return formatResults(await page.content());
      if (!dataUrl) {
        return textResult(
          'Hit a DDoS-Guard wall but the CAPTCHA image did not load. Try annas_search_books again.',
          true,
        );
      }
      await saveCaptchaPng(dataUrl);
      pending = { query: args.query, format: args.format };
      return captchaRequiredResult(dataUrl);
    }

    return textResult(
      'The search page loaded but showed neither results nor a known CAPTCHA wall. The mirror may be down or its layout changed. Try again or set ANNAS_BASE_URL to another mirror.',
      true,
    );
  },
);

server.tool(
  'annas_solve_captcha',
  "Submit the answer to a CAPTCHA raised by annas_search_books, then resume the search. Provide the exact characters shown in the CAPTCHA image (from your own reading of it, or from the user). Returns the search results on success, or a fresh CAPTCHA image if the answer was rejected.",
  {
    answer: z.string().describe('The characters shown in the CAPTCHA image'),
  },
  async (args) => {
    if (!context || !currentPage || currentPage.isClosed() || !pending) {
      return textResult(
        'No CAPTCHA is pending. Call annas_search_books first (a CAPTCHA is only solvable while its search is in flight).',
        true,
      );
    }
    const page = currentPage;

    try {
      await submitCaptcha(page, args.answer);
    } catch (e) {
      return textResult(
        `Could not submit the CAPTCHA answer: ${e instanceof Error ? e.message : String(e)}. Try annas_search_books again.`,
        true,
      );
    }

    const outcome = await waitForOutcome(page, 20000);
    if (outcome === 'results') {
      pending = null;
      return formatResults(await page.content());
    }

    // Still walled — usually a rejected answer with a fresh image.
    const dataUrl = await readCaptchaImage(page);
    if (dataUrl) {
      await saveCaptchaPng(dataUrl);
      return captchaRequiredResult(
        dataUrl,
        'That answer was not accepted (or a new CAPTCHA appeared).',
      );
    }

    return textResult(
      'Submitted the answer but the page resolved to neither results nor a new CAPTCHA. State is unclear — try annas_search_books again.',
      true,
    );
  },
);

server.tool(
  'annas_download_book',
  "Download a book from Anna's Archive using its MD5 hash. Returns the local file path.",
  {
    md5: z.string().describe('MD5 hash from annas_search_books'),
    filename: z.string().describe('Output filename with extension, e.g. "book.epub"'),
  },
  async (args) => {
    if (!SECRET_KEY) throw new Error('ANNAS_SECRET_KEY not set — donor API key required');
    const base = workingBase || MIRRORS[0];

    const apiUrl = `${base}/dyn/api/fast_download.json?md5=${args.md5}&key=${SECRET_KEY}`;
    const apiResp = await fetch(apiUrl, { headers: { 'User-Agent': UA } });
    if (!apiResp.ok)
      throw new Error(`Fast download API failed (${apiResp.status}): ${await apiResp.text()}`);

    const result = (await apiResp.json()) as { download_url?: string; error?: string };
    if (result.error) throw new Error(`Download API error: ${result.error}`);
    if (!result.download_url) throw new Error('No download URL in API response');

    const fileResp = await fetch(result.download_url, { headers: { 'User-Agent': UA } });
    if (!fileResp.ok) throw new Error(`File download failed (${fileResp.status})`);

    await fs.mkdir(DOWNLOAD_PATH, { recursive: true });
    const outPath = path.join(DOWNLOAD_PATH, args.filename);
    const buf = Buffer.from(await fileResp.arrayBuffer());
    await fs.writeFile(outPath, buf);

    const sizeMB = (buf.length / 1024 / 1024).toFixed(2);
    return textResult(`Downloaded to ${outPath} (${sizeMB} MB)`);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
