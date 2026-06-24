# nanoclaw-web

A minimal React + Vite chat UI for **nanoclaw**, built on the
[assistant-ui](https://www.assistant-ui.com/) `ExternalStoreRuntime`. It's a
thin vertical slice that proves an end-to-end round trip against a nanoclaw
backend: multiple conversations (sidebar thread list) + a chat thread, text
only.

> **Scope of this slice:** no attachments, no auth, no persistence across
> reload. The store is in-memory; refreshing the page starts fresh.

## How it talks to the host

A single constant `platformId = "web:local"` identifies the (single, unauthed)
user. Each conversation gets a client-generated `threadId` (`crypto.randomUUID()`).
A brand-new conversation just uses a fresh `threadId`; its first `POST` creates
the backend session.

All requests use **relative URLs** so the same build works in dev (through the
Vite proxy) and in prod (the host serves the built files from the same origin).

### Transport contract

1. **Send a user message** — `POST /api/send`

   ```json
   { "platformId": "web:local", "threadId": "<uuid>", "text": "<user message>" }
   ```

   responds `{ "ok": true, "id": "<string>" }`. The client does **not** wait for
   the assistant reply here — replies are async/push.

2. **Receive replies** — `GET /api/stream?platformId=web:local` (SSE,
   `text/event-stream`). Named events:

   - `event: ready` — `data: {}` (on connect)
   - `event: message` — `data: { "threadId": "<uuid|null>", "message": { "id", "role": "assistant", "text", "createdAt": "<ISO>" } }`.
     Appended to the matching thread (the thread entry is created if missing, so
     out-of-band pushed messages still land).
   - `event: typing` — `data: { "threadId": "<uuid|null>" }`. Sets that thread's
     `isRunning = true`.

## Run it

1. **Start the nanoclaw host with the `web` channel.** It listens on
   `http://localhost:8787` and exposes `/api/send` + `/api/stream`.

2. **Install deps and start the dev server:**

   ```bash
   cd web
   npm install
   npm run dev
   ```

   Open the URL Vite prints (default <http://localhost:5173>). The dev server
   proxies `/api` → `http://localhost:8787` (with `changeOrigin: true`; SSE
   works through the proxy).

   If the pinned versions are stale, refresh the two moving deps:

   ```bash
   npm install @assistant-ui/react@latest zustand
   ```

3. **Production build:**

   ```bash
   npm run build      # outputs to dist/
   npm run preview    # serve the build locally
   ```

   In production the host serves the contents of `dist/`, so the relative
   `/api` URLs resolve against the same origin (no proxy required).

## Layout

| File | Purpose |
|------|---------|
| `src/store.ts` | zustand store: messages / titles / running maps + the **centralized** `currentThreadId` |
| `src/runtime.tsx` | builds the `ExternalStoreRuntime`, wires `onNew` + the thread-list adapter, runs the SSE effect |
| `src/App.tsx` | sidebar (thread list) + main thread layout |
| `src/ui/ThreadList.tsx` | thread list primitives |
| `src/ui/Thread.tsx` | thread viewport, messages, composer |
| `src/styles.css` | plain CSS — no framework |

## Notes / things to verify after `npm install`

The exact assistant-ui primitive sub-component names (e.g.
`ThreadPrimitive.Empty`, `ThreadListPrimitive.Items`'s `components` prop,
`MessagePrimitive.Parts`) are based on the documented API. A couple of
`// TODO verify against installed types` comments mark spots to confirm against
the installed `@assistant-ui/react` typings if the build complains.
