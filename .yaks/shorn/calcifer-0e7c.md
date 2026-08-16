---
id: calcifer-0e7c
title: Agent-produced deep links into the app UI (app_link for view records)
type: feature
priority: 2
created: '2026-08-16T19:00:06Z'
updated: '2026-08-16T19:12:13Z'
parent: calcifer-7c3a
labels:
- skill-views
---

PARENT: calcifer-7c3a

The agent can surface a view record as an interactive card (send_record_card({view,id})) but has no way to hand the user a plain LINK into the app UI. Observed failure: asked to "point me to that doc directly", the agent linked the raw Seafile download endpoint (files.j15r.com/f/…?dl=1) because that was the only URL-shaped thing it had. Better would be an in-app deep link, e.g. /app/family-wiki/health%2Flegal%2Fjay-name-change%2FConsent_and_Acknowledgment.md — a live, interactive, auth-scoped view of the object.

GROUND TRUTH (this session):
- Addressing already exists: agents speak (view,id) — same args as send_record_card (container/agent-runner/src/mcp-tools/interactive.ts). For file-backed libraries id = path relative to library root.
- Deep-link route exists: /app/:view/:id (web/src/App.tsx). Cards build "Open" as /app/<view>/encodeURIComponent(id) (web/src/ui/Card.tsx). Card actions whose url starts with "/" route via react-router; else external new tab.
- Host record route uses (.+) + decodeURIComponent, so ids-with-slashes MUST be %2F-encoded.
- NO public base URL is stored today (only a comment: funnel hearth.hamlet-algol.ts.net). WEB_UI_SECURE_COOKIE exists; no WEB_UI_PUBLIC_URL.

DESIGN (proposed, pending owner confirmation):
- Add an app_link({view,id}) MCP tool mirroring send_record_card: returns a correct, host-encoded deep link (host owns the URL scheme + encoding, not the agent). Orthogonal pair: card = interactive projection, link = plain URL. Add a one-line nudge to the views instructions: prefer an app link over a raw backend URL when the thing exists as a view record; reserve raw endpoints for explicit direct-download asks.

OPEN QUESTIONS / ISSUES:
1. Relative vs absolute. Web chat only needs relative /app/... (zero config). Cross-channel delivery (WhatsApp/SMS/email) needs an ABSOLUTE url -> requires a new WEB_UI_PUBLIC_URL config. Owner leans portable/shareable (dovetails with family sharing).
2. Encoding correctness (slashes -> %2F) argues for a tool over hand-assembled instruction links.
3. Auth on shared links: a deep link opened without the cookie hits the funnel login gate -> must land back on the deep-linked object (confirm login preserves redirect target; ties into 7c3a.6).
4. In-chat smoothness (minor): for a relative /app/... markdown link to route within the SPA instead of full-reload, chat Prose needs an onNavigate wired to react-router (chat Prose currently has none, calcifer-d1f8). Full-nav still works.
5. Generalize across all views (apartments/wiki/documents/pictures/books), same (view,id) scheme.

---
▸ 2026-08-16T19:12:13Z
Shipped v0. Decisions confirmed with owner: (1) RELATIVE links — browsers absolutize on click/copy in the web-chat flow family will use, so no WEB_UI_PUBLIC_URL config needed; (2) a TOOL, not hand-assembled instruction links (encoding is the trap); (3) app links are the 99% default, raw backend/download URLs reserved for explicit direct-download asks.

Implemented app_link({view,id}) MCP tool (container/agent-runner/src/mcp-tools/interactive.ts): returns /app/<view>/<encodeURIComponent(id)>, mirroring the card Open button. Pure/no DB. Instruction nudge added to interactive.instructions.md (new 'Linking to a record' subsection + default-posture guidance + link-vs-card rule of thumb). Unit test (3 cases incl. the exact wiki path from the report) + container typecheck green. Live on next container spawn (source is RO-mounted).

Deferred (spun out as ideas): cross-channel ABSOLUTE links (WhatsApp/SMS need a configured public base URL) — regrow if it ever matters; shared-link login-redirect; cards-vs-links / client-side unfurling.
