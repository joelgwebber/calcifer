---
id: calcifer-da67.3
title: Investigate OneCLI as credential backend for container MCP tools
type: task
priority: 1
created: '2026-04-18T22:48:25Z'
updated: '2026-04-18T22:54:23Z'
commit: '4301104'
---

Determine whether OneCLI can replace our ad-hoc env var injection in container-runner.ts for all MCP tool credentials (Seafile, WorkFlowy, Readeck, Fastmail, Substack). Check: is OneCLI running/configured on hearth? Can it inject non-Anthropic service credentials (REST API tokens, IMAP passwords)? If yes, migrate to OneCLI and drop the hardcoded secrets block entirely — aligning with upstream. If no (e.g. OneCLI only handles HTTPS API keys and can't cover IMAP), document which credentials need env vars and design the per-group override cleanly. This yak blocks: da67.1.1 (per-group .env), da67.3 (dynamic injection), da67.4 (container skills).

## Findings (2026-04-18)

**Two separate credential problems — Claude API vs. MCP service creds:**

### Claude API credentials (for containers to call Claude)
Upstream originally used `src/credential-proxy.ts` — a local HTTP proxy on port 3001 that
intercepts container API traffic and injects the real `ANTHROPIC_API_KEY`. Upstream then
switched to OneCLI gateway (removed credential-proxy.ts). We had merged that OneCLI version
without configuring OneCLI, leaving containers with no Claude credentials.

**Fix applied (2026-04-18):** Merged `upstream/skill/native-credential-proxy` to restore
the built-in credential proxy. Containers now get `ANTHROPIC_BASE_URL` pointing at
`http://host:3001` and `ANTHROPIC_API_KEY=placeholder`; the proxy replaces the placeholder
with the real key from `.env`. Confirmed working: logs show
`Credential proxy started port: 3001 authMode: "api-key"`.

### MCP service credentials (Fastmail, Seafile, Readeck, WorkFlowy, Substack)
**OneCLI cannot replace env var injection.** OneCLI works as an HTTPS proxy; our MCP servers
read credentials from `process.env` at startup. Fastmail uses IMAP/SMTP (not HTTPS).
OneCLI has no mechanism to set process env vars.

**Decision: keep `-e KEY=VALUE` env var injection.** Proceed with:
- da67.4: make injection dynamic (read all vars from .env, no hardcoded list)
- da67.1.1: per-group .env with global fallback
