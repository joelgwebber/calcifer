/**
 * Web channel — browser/mobile UI over plain HTTP (SSE + POST).
 *
 * A native channel adapter that fronts an assistant-ui frontend (see `web/`).
 * It speaks the same router/delivery contract as every other adapter — inbound
 * via `config.onInbound`, outbound via `deliver` — but the transport is HTTP
 * instead of a platform SDK, so it pulls in ZERO new host dependencies (Node's
 * built-in `http`, server-sent events for push, POST for inbound).
 *
 * Wire format:
 *
 *   Client → server:
 *     POST /api/send  { "platformId": "web:local", "threadId": "<uuid>", "text": "..." }
 *       → { "ok": true, "id": "<inbound id>" }
 *
 *   Server → client (SSE):
 *     GET /api/stream?platformId=web:local
 *       event: ready    data: {}
 *       event: message  data: { threadId, message: { id, role:"assistant", text, createdAt } }
 *       event: typing   data: { threadId }
 *
 * Design notes (see yak calcifer-7c3a):
 *   - supportsThreads = true. Each assistant-ui thread carries its own
 *     `threadId`; wired with session_mode=per-thread, that gives one session →
 *     one container → one isolated context per conversation (the segregation
 *     guarantee — distinct threads never share context).
 *   - The agent group is implied by the wiring (and, later, by login context).
 *     One user → one agent group → many threads. No agent switching in the UI.
 *   - `isRunning` on the client is deliberately simple for this slice: true on
 *     send, false when an assistant message arrives. `typing` is a best-effort
 *     hint. A richer per-turn running signal is tracked in calcifer-7c3a.8.
 *   - Multi-client: every connected SSE stream for a platformId receives each
 *     delivery (unlike the single-client CLI socket), so multiple tabs/devices
 *     stay in sync.
 *
 * Auth is NOT implemented yet (calcifer-7c3a.6). For the slice, wire the web
 * messaging group with `unknown_sender_policy=public` and a fixed platform_id
 * (`web:local`). Do not expose the port publicly until auth lands.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';

import { log } from '../log.js';
import type { ChannelAdapter, ChannelSetup, OutboundMessage } from './adapter.js';
import { registerChannelAdapter } from './channel-registry.js';

const CHANNEL_TYPE = 'web';
const DEFAULT_PLATFORM_ID = 'web:local';
const DEFAULT_PORT = 8787;
const MAX_BODY_BYTES = 1_000_000;
const SSE_PING_MS = 25_000;

function configuredPort(): number {
  const raw = process.env.WEB_UI_PORT;
  const n = raw ? parseInt(raw, 10) : DEFAULT_PORT;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PORT;
}

interface SseClient {
  res: http.ServerResponse;
  platformId: string;
}

function rand(): string {
  return Math.random().toString(36).slice(2, 8);
}

function extractText(message: OutboundMessage): string | null {
  const content = message.content as Record<string, unknown> | string | undefined;
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object' && typeof content.text === 'string') {
    return content.text;
  }
  return null;
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function createAdapter(): ChannelAdapter {
  let server: http.Server | null = null;
  const clients = new Set<SseClient>();

  function broadcast(platformId: string, event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      if (client.platformId !== platformId) continue;
      try {
        client.res.write(payload);
      } catch {
        // Dead socket — it'll be reaped by the 'close' handler. Skip.
      }
    }
  }

  function handleStream(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
    const platformId = url.searchParams.get('platformId') || DEFAULT_PLATFORM_ID;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.write('event: ready\ndata: {}\n\n');

    const client: SseClient = { res, platformId };
    clients.add(client);
    log.info('Web SSE client connected', { platformId, total: clients.size });

    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        // Reaped on close.
      }
    }, SSE_PING_MS);

    req.on('close', () => {
      clearInterval(ping);
      clients.delete(client);
      log.info('Web SSE client disconnected', { platformId, total: clients.size });
    });
  }

  function handleSend(req: http.IncomingMessage, res: http.ServerResponse, config: ChannelSetup): void {
    let body = '';
    let aborted = false;
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        aborted = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end('{"error":"payload too large"}');
        req.destroy();
      }
    });
    req.on('end', () => {
      if (aborted) return;
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(body) as Record<string, unknown>;
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"invalid json"}');
        return;
      }

      const text = typeof payload.text === 'string' ? payload.text : '';
      const threadId = typeof payload.threadId === 'string' ? payload.threadId : null;
      const platformId = typeof payload.platformId === 'string' ? payload.platformId : DEFAULT_PLATFORM_ID;
      if (!text) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"empty text"}');
        return;
      }

      const id = `web-in-${Date.now()}-${rand()}`;
      void Promise.resolve(
        config.onInbound(platformId, threadId, {
          id,
          kind: 'chat',
          timestamp: new Date().toISOString(),
          // Direct address: the web user is always talking to their agent.
          isMention: true,
          isGroup: true,
          content: { text, sender: 'web', senderId: platformId },
        }),
      ).catch((err) => log.error('web onInbound threw', { err }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, id }));
    });
  }

  function serveStatic(url: URL, res: http.ServerResponse): void {
    const distDir = path.resolve(process.cwd(), 'web', 'dist');
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = path.normalize(path.join(distDir, requested));
    // Path-traversal guard: resolved path must stay inside distDir.
    if (filePath !== distDir && !filePath.startsWith(distDir + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        // SPA fallback — unknown paths render index.html (client-side routing).
        fs.readFile(path.join(distDir, 'index.html'), (fallbackErr, indexHtml) => {
          if (fallbackErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Web UI not built. Run the dev server in web/ (npm run dev) or build it (npm run build).');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(indexHtml);
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream' });
      res.end(data);
    });
  }

  function handleRequest(req: http.IncomingMessage, res: http.ServerResponse, config: ChannelSetup): void {
    // Permissive CORS so a cross-origin dev server also works (the Vite proxy
    // makes this same-origin in practice, but this keeps direct access easy).
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/stream') {
      handleStream(req, res, url);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/send') {
      handleSend(req, res, config);
      return;
    }
    serveStatic(url, res);
  }

  const adapter: ChannelAdapter = {
    name: 'web',
    channelType: CHANNEL_TYPE,
    supportsThreads: true,

    async setup(config: ChannelSetup): Promise<void> {
      const portNum = configuredPort();
      server = http.createServer((req, res) => handleRequest(req, res, config));
      await new Promise<void>((resolve, reject) => {
        server!.once('error', reject);
        server!.listen(portNum, () => {
          log.info('Web channel listening', { port: portNum });
          resolve();
        });
      });
    },

    async teardown(): Promise<void> {
      for (const client of clients) {
        try {
          client.res.end();
        } catch {
          // best-effort
        }
      }
      clients.clear();
      if (server) {
        await new Promise<void>((resolve) => {
          server!.close(() => resolve());
        });
        server = null;
      }
    },

    isConnected(): boolean {
      return server !== null;
    },

    async deliver(platformId, threadId, message: OutboundMessage): Promise<string | undefined> {
      // Slice scope: text only. Cards (send_card) and file attachments are
      // tracked in calcifer-7c3a.4 / calcifer-7c3a.3 respectively.
      const text = extractText(message);
      if (text === null) return undefined;
      const id = `web-out-${Date.now()}-${rand()}`;
      broadcast(platformId, 'message', {
        threadId: threadId ?? null,
        message: { id, role: 'assistant', text, createdAt: new Date().toISOString() },
      });
      return undefined;
    },

    async setTyping(platformId, threadId): Promise<void> {
      broadcast(platformId, 'typing', { threadId: threadId ?? null });
    },
  };

  return adapter;
}

registerChannelAdapter('web', { factory: createAdapter });
