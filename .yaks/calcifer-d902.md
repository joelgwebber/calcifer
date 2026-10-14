---
id: calcifer-d902
title: Support installation and use of the sightmap browser tools
status: shaving
type: task
priority: 3
created: '2026-09-10T23:01:13Z'
updated: '2026-09-10T23:47:26Z'
labels:
- sightmap
- skills
---

Track the changes needed so this install reliably installs and uses the sightmap browser tooling (the sightmap CLI plus its sightmap-* skills). Learned while working calcifer-0e32.

Two concrete points to capture now:

1. Persistent Chrome profile. Our own skills/docs should make the point of always driving sightmap (and any Playwright-based browser automation we add, e.g. in the annas MCP server) with a PERSISTENT Chrome profile, so cookies stick between sessions. This matters directly for bot-walls like DDoS-Guard: a challenge solved once (by a human, or by a vision model) sets __ddg* cookies that a persistent profile reuses on later runs until they expire. Note sightmap already uses a persistent profile at ~/.sightmap/profiles/<slug> by default; the action here is (a) document this as the expected pattern in our own skills/docs, and (b) make sure anything we build reuses a profile rather than a fresh incognito context each run.

2. Install / update path. The sightmap tool is normally installed and updated via: npm i -g @sightmap/sightmap. It was installed manually for this work. Our setup/docs for the browser tooling should reference this canonical install command (and the sightmap-* skills, installed via 'sightmap skills install').

Scope is deliberately about our own repo's skills/docs/setup for using sightmap, not editing the vendor's global sightmap-* skills.

Related: calcifer-0e32 is the concrete consumer that motivated this.

---
▸ 2026-09-10T23:28:55Z [Joel Webber]
Confirmed the persistence premise live (via calcifer-0e32 work): solving one DDoS-Guard captcha sets __ddg* cookies that a persistent Chromium profile reuses, so later searches skip the wall entirely (verified on annas-archive.gl — second unrelated search returned results with no captcha).

Concrete follow-up this yak should carry, now that a consumer exists: the annas MCP server uses a persistent profile at ANNAS_PROFILE_DIR (default /tmp/annas-browser-profile). /tmp is per-container and dies with the --rm container, so today a captcha solved in one session is re-asked in the next. For real cross-session persistence, ANNAS_PROFILE_DIR should point at a MOUNTED host path (a per-group cache mount), so the cookie jar survives container restarts. That mount wiring is the missing piece — capture it here rather than in 0e32.

Also: sightmap itself already uses a persistent profile (~/.sightmap/profiles/<slug>) by default, so the host-side tooling is fine as-is; the doc action is to state the persistent-profile expectation for any browser automation WE add (like the annas MCP server) and to reference the canonical install npm i -g @sightmap/sightmap.

---
▸ 2026-09-10T23:47:26Z [Joel Webber]
Reinforced by the 0e32 container run: the annas MCP server defaults ANNAS_PROFILE_DIR to /tmp/annas-browser-profile, which is per-container (dies with --rm). In-container the JS auto-check cleared automatically (no captcha), but when a manual captcha IS solved, its __ddg* cookies would be lost on the next container. So the mounted-profile follow-up this yak tracks is what makes solve-once-then-ride-cookies actually hold across sessions. Also note the build gates on a vendored tools/yaks/yak.py via ./container/sync-yaks.sh, and that script is stale (upstream yaks removed commands/, so it errors after copying yak.py+yaklib) -- worth fixing under this tooling yak too.
