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
import type { AuthedUser } from './web-auth.js';
import {
  authenticateRequest,
  clearFailures,
  getCredential,
  isLockedOut,
  issueSession,
  recordFailure,
  requireAuth,
  SESSION_COOKIE,
  sessionCookieHeader,
  verifyPassword,
} from './web-auth.js';
import type { ChannelAdapter, ChannelSetup, OutboundMessage } from './adapter.js';
import type { NormalizedOption } from './ask-question.js';
import { registerChannelAdapter } from './channel-registry.js';
import { listThreads, loadThreadHistory } from './web-history.js';
import {
  annotateForUser,
  cardFromContent,
  fileForUser,
  getManifestForClient,
  listViews,
  queryViewForUser,
  recordForUser,
  ViewDataError,
} from './web-views.js';

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

/**
 * Resolve the authenticated user for a request. With auth enabled (the secure
 * default), this is the cookie-verified user or null. With auth disabled
 * (WEB_UI_REQUIRE_AUTH=false, local dev only), it falls back to a synthetic
 * `web:local` user so the single-tenant no-auth flow still works.
 *
 * The user's id doubles as its routing platform_id, so everything downstream
 * (SSE scope, inbound sender, history/thread lookups) keys off `userId` and a
 * client can never spoof another user's namespace.
 */
function resolveUser(req: http.IncomingMessage): AuthedUser | null {
  if (!requireAuth()) {
    return { userId: DEFAULT_PLATFORM_ID, displayName: null, handle: 'local' };
  }
  return authenticateRequest(req.headers.cookie);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function unauthorized(res: http.ServerResponse): void {
  sendJson(res, 401, { error: 'unauthorized' });
}

/** Read a request body up to MAX_BODY_BYTES, rejecting oversize payloads. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('payload too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
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

  // Live interactive prompts (ask_user_question + host/onecli approvals, all
  // delivered as `ask_question` payloads) awaiting a click: questionId ->
  // options, used to validate a posted answer. Best-effort — cleared on answer
  // and bounded; a miss (e.g. after a host restart) just skips validation, the
  // pending_* row in the DB is still the source of truth (calcifer-7c3a.5).
  const pendingQuestions = new Map<string, NormalizedOption[]>();
  const PENDING_QUESTIONS_MAX = 128;

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

  function handleStream(req: http.IncomingMessage, res: http.ServerResponse): void {
    const user = resolveUser(req);
    if (!user) {
      unauthorized(res);
      return;
    }
    // SSE is scoped to the authenticated user's own platform_id — a client
    // cannot subscribe to another user's stream.
    const platformId = user.userId;
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

  async function handleSend(req: http.IncomingMessage, res: http.ServerResponse, config: ChannelSetup): Promise<void> {
    const user = resolveUser(req);
    if (!user) {
      unauthorized(res);
      return;
    }

    let body: string;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 413, { error: 'payload too large' });
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      sendJson(res, 400, { error: 'invalid json' });
      return;
    }

    const text = typeof payload.text === 'string' ? payload.text : '';
    const threadId = typeof payload.threadId === 'string' ? payload.threadId : null;
    if (!text) {
      sendJson(res, 400, { error: 'empty text' });
      return;
    }

    // platform_id + sender identity are derived from the authenticated user,
    // NEVER from the client. senderId is the nanoclaw user id so the router's
    // permission gate resolves the real user (owner/member) for this agent.
    const platformId = user.userId;
    const id = `web-in-${Date.now()}-${rand()}`;
    try {
      await Promise.resolve(
        config.onInbound(platformId, threadId, {
          id,
          kind: 'chat',
          timestamp: new Date().toISOString(),
          // Direct address: the web user is always talking to their agent.
          isMention: true,
          isGroup: true,
          content: {
            text,
            sender: user.handle,
            senderId: user.userId,
            senderName: user.displayName ?? undefined,
          },
        }),
      );
    } catch (err) {
      log.error('web onInbound threw', { err });
    }

    sendJson(res, 200, { ok: true, id });
  }

  function handleHistory(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
    const user = resolveUser(req);
    if (!user) {
      unauthorized(res);
      return;
    }
    const threadId = url.searchParams.get('threadId');
    if (!threadId) {
      sendJson(res, 400, { error: 'threadId required' });
      return;
    }
    try {
      // Scoped to the authenticated user's own messaging group.
      const messages = loadThreadHistory(user.userId, threadId);
      sendJson(res, 200, { messages });
    } catch (err) {
      log.error('web history load failed', { err });
      sendJson(res, 500, { error: 'history load failed' });
    }
  }

  function handleThreads(req: http.IncomingMessage, res: http.ServerResponse): void {
    const user = resolveUser(req);
    if (!user) {
      unauthorized(res);
      return;
    }
    try {
      const threads = listThreads(user.userId);
      sendJson(res, 200, { threads });
    } catch (err) {
      log.error('web thread list failed', { err });
      sendJson(res, 500, { error: 'thread list failed' });
    }
  }

  async function handleLogin(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body: string;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 413, { error: 'payload too large' });
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      sendJson(res, 400, { error: 'invalid json' });
      return;
    }
    const handle = typeof payload.handle === 'string' ? payload.handle.trim().toLowerCase() : '';
    const password = typeof payload.password === 'string' ? payload.password : '';
    if (!handle || !password) {
      sendJson(res, 400, { error: 'handle and password required' });
      return;
    }

    const userId = `web:${handle}`;
    if (isLockedOut(userId)) {
      sendJson(res, 429, { error: 'too many attempts, try again later' });
      return;
    }

    const cred = getCredential(userId);
    // Always run verify (even with no row) to keep timing uniform, then decide.
    const ok = cred ? verifyPassword(password, cred.pw_hash) : false;
    if (!ok) {
      recordFailure(userId);
      // Generic message — don't reveal whether the handle exists.
      sendJson(res, 401, { error: 'invalid credentials' });
      return;
    }

    clearFailures(userId);
    const token = issueSession(userId);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader(token),
    });
    const user = authenticateRequest(`${SESSION_COOKIE}=${token}`);
    res.end(JSON.stringify({ handle, displayName: user?.displayName ?? null }));
  }

  function handleLogout(res: http.ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader(null),
    });
    res.end('{"ok":true}');
  }

  function handleMe(req: http.IncomingMessage, res: http.ServerResponse): void {
    const user = resolveUser(req);
    if (!user) {
      unauthorized(res);
      return;
    }
    sendJson(res, 200, { handle: user.handle, displayName: user.displayName, authRequired: requireAuth() });
  }

  function sendViewError(res: http.ServerResponse, err: unknown): void {
    if (err instanceof ViewDataError) {
      sendJson(res, err.status, { error: err.message });
      return;
    }
    log.error('view request failed', { err });
    sendJson(res, 500, { error: 'internal error' });
  }

  function handleViewsList(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (!resolveUser(req)) {
      unauthorized(res);
      return;
    }
    sendJson(res, 200, { views: listViews() });
  }

  function handleViewManifest(req: http.IncomingMessage, res: http.ServerResponse, view: string): void {
    if (!resolveUser(req)) {
      unauthorized(res);
      return;
    }
    try {
      sendJson(res, 200, { manifest: getManifestForClient(view) });
    } catch (err) {
      sendViewError(res, err);
    }
  }

  function handleViewData(req: http.IncomingMessage, res: http.ServerResponse, view: string, url: URL): void {
    const user = resolveUser(req);
    if (!user) {
      unauthorized(res);
      return;
    }
    let filters: Record<string, unknown> = {};
    const rawFilters = url.searchParams.get('filters');
    if (rawFilters) {
      try {
        filters = JSON.parse(rawFilters) as Record<string, unknown>;
      } catch {
        sendJson(res, 400, { error: 'filters must be valid JSON' });
        return;
      }
    }
    const pageRaw = parseInt(url.searchParams.get('page') ?? '', 10);
    const pageSizeRaw = parseInt(url.searchParams.get('pageSize') ?? '', 10);
    try {
      const result = queryViewForUser(user.userId, view, {
        collection: url.searchParams.get('collection') ?? undefined,
        filters,
        q: url.searchParams.get('q') ?? undefined,
        sort: url.searchParams.get('sort') ?? undefined,
        page: Number.isFinite(pageRaw) ? pageRaw : undefined,
        pageSize: Number.isFinite(pageSizeRaw) ? pageSizeRaw : undefined,
        browse: url.searchParams.get('browse') === '1',
        path: url.searchParams.get('path') ?? undefined,
      });
      sendJson(res, 200, result);
    } catch (err) {
      sendViewError(res, err);
    }
  }

  function handleViewRecord(req: http.IncomingMessage, res: http.ServerResponse, view: string, id: string): void {
    const user = resolveUser(req);
    if (!user) {
      unauthorized(res);
      return;
    }
    try {
      const record = recordForUser(user.userId, view, id);
      if (!record) {
        sendJson(res, 404, { error: 'record not found' });
        return;
      }
      sendJson(res, 200, { record });
    } catch (err) {
      sendViewError(res, err);
    }
  }

  /** Stream a raw file from an fs-backed view (inline, or ?download=1 to force save). */
  function handleViewFile(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    view: string,
    id: string,
    url: URL,
  ): void {
    const user = resolveUser(req);
    if (!user) {
      unauthorized(res);
      return;
    }
    try {
      const file = fileForUser(user.userId, view, id);
      if (!file) {
        sendJson(res, 404, { error: 'file not found' });
        return;
      }
      const download = url.searchParams.get('download') === '1';
      const filename = path.basename(file.path).replace(/["\\\r\n]/g, '');
      res.writeHead(200, {
        'Content-Type': file.contentType,
        'Content-Length': String(file.size),
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Cache-Control': 'private, max-age=60',
      });
      fs.createReadStream(file.path)
        .on('error', () => {
          if (!res.headersSent) sendJson(res, 500, { error: 'read failed' });
          else res.end();
        })
        .pipe(res);
    } catch (err) {
      sendViewError(res, err);
    }
  }

  async function handleAnnotate(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!resolveUser(req)) {
      unauthorized(res);
      return;
    }
    let body: string;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 413, { error: 'payload too large' });
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      sendJson(res, 400, { error: 'invalid json' });
      return;
    }
    const view = typeof payload.view === 'string' ? payload.view : '';
    const entityId = typeof payload.entity_id === 'string' ? payload.entity_id : '';
    const key = typeof payload.key === 'string' ? payload.key : '';
    const value =
      typeof payload.value === 'string' ? payload.value : payload.value == null ? null : String(payload.value);
    try {
      annotateForUser(view, entityId, key, value);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendViewError(res, err);
    }
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

  // A click on an interactive prompt's option button (ask_user_question / host
  // approval / onecli). Resolves userId from the authenticated session (never
  // trusted from the client), then hands off to the host's onAction, which
  // routes through dispatchResponse to whatever handler owns the pending row
  // (calcifer-7c3a.5).
  async function handleAction(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    config: ChannelSetup,
  ): Promise<void> {
    const user = resolveUser(req);
    if (!user) {
      unauthorized(res);
      return;
    }
    let body: string;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 413, { error: 'payload too large' });
      return;
    }
    let parsed: { questionId?: unknown; value?: unknown };
    try {
      parsed = JSON.parse(body);
    } catch {
      sendJson(res, 400, { error: 'invalid json' });
      return;
    }
    const { questionId, value } = parsed;
    if (typeof questionId !== 'string' || !questionId || typeof value !== 'string') {
      sendJson(res, 400, { error: 'questionId and value required' });
      return;
    }
    // Validate against the delivered options when we still have them. A miss is
    // permissive: the pending row in the DB is authoritative and may outlive our
    // in-memory map (e.g. across a host restart).
    const options = pendingQuestions.get(questionId);
    if (options && !options.some((o) => o.value === value)) {
      sendJson(res, 400, { error: 'unknown option' });
      return;
    }
    pendingQuestions.delete(questionId);
    config.onAction(questionId, value, user.userId);
    // Nudge every tab on this user's stream to show the prompt as answered.
    broadcast(user.userId, 'answered', { questionId, value });
    sendJson(res, 200, { ok: true });
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
    const fail = (err: unknown) => {
      log.error('web request handler threw', { path: url.pathname, err });
      try {
        sendJson(res, 500, { error: 'internal error' });
      } catch {
        // response already partially sent
      }
    };

    // Auth endpoints (ungated — they establish or report the session).
    if (req.method === 'POST' && url.pathname === '/api/login') {
      void handleLogin(req, res).catch(fail);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      handleLogout(res);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/me') {
      handleMe(req, res);
      return;
    }

    // Data endpoints (auth-gated inside each handler via resolveUser).
    if (req.method === 'GET' && url.pathname === '/api/stream') {
      handleStream(req, res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/send') {
      void handleSend(req, res, config).catch(fail);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/action') {
      void handleAction(req, res, config).catch(fail);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/history') {
      handleHistory(req, res, url);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/threads') {
      handleThreads(req, res);
      return;
    }

    // Skill views (calcifer-1d51).
    if (req.method === 'GET' && url.pathname === '/api/views') {
      handleViewsList(req, res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/annotations') {
      void handleAnnotate(req, res).catch(fail);
      return;
    }
    const viewDataMatch = /^\/api\/views\/([^/]+)\/data$/.exec(url.pathname);
    if (req.method === 'GET' && viewDataMatch) {
      handleViewData(req, res, decodeURIComponent(viewDataMatch[1]), url);
      return;
    }
    const viewRecordMatch = /^\/api\/views\/([^/]+)\/record\/(.+)$/.exec(url.pathname);
    if (req.method === 'GET' && viewRecordMatch) {
      handleViewRecord(req, res, decodeURIComponent(viewRecordMatch[1]), decodeURIComponent(viewRecordMatch[2]));
      return;
    }
    const viewFileMatch = /^\/api\/views\/([^/]+)\/file\/(.+)$/.exec(url.pathname);
    if (req.method === 'GET' && viewFileMatch) {
      handleViewFile(req, res, decodeURIComponent(viewFileMatch[1]), decodeURIComponent(viewFileMatch[2]), url);
      return;
    }
    const viewManifestMatch = /^\/api\/views\/([^/]+)$/.exec(url.pathname);
    if (req.method === 'GET' && viewManifestMatch) {
      handleViewManifest(req, res, decodeURIComponent(viewManifestMatch[1]));
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
      // Interactive prompt: ask_user_question + host/onecli approvals all arrive
      // as an `ask_question` payload. Render as an inline card with option
      // buttons; the click round-trips through POST /api/action -> onAction
      // (calcifer-7c3a.5).
      const content = message.content as Record<string, unknown> | undefined;
      if (
        content &&
        typeof content === 'object' &&
        content.type === 'ask_question' &&
        typeof content.questionId === 'string' &&
        Array.isArray(content.options)
      ) {
        const questionId = content.questionId;
        const options = content.options as NormalizedOption[];
        pendingQuestions.set(questionId, options);
        while (pendingQuestions.size > PENDING_QUESTIONS_MAX) {
          pendingQuestions.delete(pendingQuestions.keys().next().value!);
        }
        const id = `web-out-${Date.now()}-${rand()}`;
        broadcast(platformId, 'message', {
          threadId: threadId ?? null,
          message: {
            id,
            role: 'assistant',
            text: '',
            createdAt: new Date().toISOString(),
            question: {
              questionId,
              title: typeof content.title === 'string' ? content.title : '',
              question: typeof content.question === 'string' ? content.question : '',
              options,
            },
          },
        });
        return undefined;
      }

      // Structured cards (send_card) render as generative-UI message parts
      // (calcifer-7c3a.4). File attachments are still text-only (calcifer-7c3a.3).
      const card = cardFromContent(message.content);
      if (card) {
        const id = `web-out-${Date.now()}-${rand()}`;
        broadcast(platformId, 'message', {
          threadId: threadId ?? null,
          message: { id, role: 'assistant', text: card.fallbackText ?? '', card, createdAt: new Date().toISOString() },
        });
        return undefined;
      }

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
