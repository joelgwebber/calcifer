---
id: calcifer-569e
title: 'Fastmail MCP: search results unreliable / miss recent mail'
type: bug
priority: 2
created: '2026-08-23T15:03:16Z'
updated: '2026-08-23T18:37:55Z'
labels:
- fastmail
- mcp
- reliability
---

Investigated why a 'Table' email from Alicia (aliciawbbr@gmail.com) didn't surface in an earlier search thread. Found via direct testing on 2026-08-23. Parent yak tracking three related sub-issues found in the fastmail MCP skill/server; see child yaks.

---
▸ 2026-08-23T16:45:59Z
Research (2026-08-23): (1) Upstream qwibitai/NanoClaw is BEHIND us — its base fastmail server is the same IMAP approach, older (lacks our attachment-save + parseSearchCriteria + error-guard). No JMAP, no mail abstraction upstream. Nothing to pull. (2) Auth: app password -> HTTP 401 'not bearer' on api.fastmail.com/jmap. JMAP requires a Bearer API token; FASTMAIL_API_TOKEN needed (app pw stays for IMAP/SMTP/DAV). (3) Prior art is abundant: jmap-jam (npm, typed JMAP client, ESM, npm provenance, 2 type-only deps type-fest+jmap-rfc-types) is the client lib; whole MCP servers exist incl wyattjoh/jmap-mcp (176*, uses jmap-jam), MadLlama25/fastmail-mcp (125*), and multi-provider jgalea/mailbox-mcp (Gmail+IMAP+JMAP) + theoryzhenkov/posthaste — the provider-agnostic seam is already modeled there. (4) JMAP is NOT universal: Fastmail+self-hosted only; Gmail=Gmail API, Outlook=Graph; generalize via tool-arg shape not protocol. Recommend: keep OUR mcp wrapper (OneCLI/formatting/tool-names/supply-chain control), swap IMAP->JMAP internally (thin hand-rolled client, zero deps, no image rebuild since /app/src is mounted; or jmap-jam if scope grows). Do NOT hand full-mailbox token to an unvetted 3rd-party server. Borrow body-cleaning idea from fastmail-clean-mcp.

---
▸ 2026-08-23T17:37:21Z
PIVOT (2026-08-23): Fastmail ships a first-party native MCP at https://api.fastmail.com/mcp (unauth probe -> HTTP 401 www-authenticate Bearer, scope https://www.fastmail.com/dev/mcp; standards-compliant Streamable-HTTP MCP resource). Our stack already consumes remote MCP: McpServerConfig has {type:'http',url,headers}; resolvePluginServer + shimCwd pass http through; ClaudeProvider allowlists mcp__<name>__* and forwards mcpServers to the SDK. So wiring the native server is CONFIG-ONLY (no code, no dep, no image rebuild). Added mcpServers.fastmail-native (type http, placeholder Bearer) to groups/dm-with-joel/container.json alongside the Track-A stdio 'fastmail' server. Plan: spike native MCP first (paste MCP token -> recycle -> list tools + run the Alicia 'Table' case). If it nails cross-folder+recent, hand-rolled JMAP is unnecessary; else keep native for search/read + JMAP for gaps (attachments/send). First-party => the 3rd-party-server trust concern doesn't apply.

---
▸ 2026-08-23T17:58:05Z
GOTCHA confirmed live (2026-08-23): container.json is DERIVED from the container_configs DB table — materializeContainerJson() rewrites groups/<folder>/container.json from the DB at EVERY spawn (container-config.ts:358, called container-runner.ts:179). Hand-edits are ephemeral. A spawn between the token paste and now re-materialized the file and wiped both the fastmail-native entry and the pasted MCP token. Correct path: ncl groups config add-mcp-server (writes DB), then recycle. Also: the 9 'native' tools reported earlier were actually our stdio fastmail server (mcp__fastmail__*); Fastmail's native MCP was never loaded, so it remains untested.

---
▸ 2026-08-23T18:37:55Z
RESOLVED 2026-08-23 per Joel's testing. Outcome: .1/.2 = Track A fixes on the stdio fastmail server (await all simpleParser promises -> deterministic result sets; newest-first ordering). .3 = wired Fastmail's first-party native MCP (fastmail-native, type:http) — config-only. Hand-rolled JMAP client left parked as fallback. Ops learnings captured in CALCIFER.md.
