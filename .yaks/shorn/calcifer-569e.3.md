---
id: calcifer-569e.3
title: fastmail skill has no cross-folder or full-text search primitive
type: enhancement
priority: 3
created: '2026-08-23T15:06:35Z'
updated: '2026-08-23T18:37:55Z'
parent: calcifer-569e
labels:
- fastmail
- mcp
- search
source: Joel + Calcifer investigation, 2026-08-23
---

The fastmail skill (/app/skills/fastmail/SKILL.md) only exposes fastmail_list_messages, which is scoped to a single folder and to basic IMAP SEARCH criteria (UNSEEN, FROM, SUBJECT, etc). There is no way to search across all folders (INBOX, Archive, and 20+ other folders) in one call, so finding an email of unknown location requires manually iterating folder-by-folder. Suggested fix: add a tool (or document a pattern) for cross-folder / full-text search, e.g. iterating fastmail_list_folders() + list_messages per folder, or a dedicated IMAP SEARCH ALL-mailboxes primitive if the underlying library/server supports it.

---
▸ 2026-08-23T16:01:14Z
Research (2026-08-23): recommend Fastmail JMAP as the general fix. GET https://api.fastmail.com/jmap/session (Bearer API token) -> apiUrl + accountId (primaryAccounts['urn:ietf:params:jmap:mail']). Then POST Email/query {filter:{text|from|subject, after/before}, sort:[{property:'receivedAt',isAscending:false}], position/limit} chained via #ids back-ref to Email/get for headers. filter.text with no inMailbox = server-side full-text across ALL folders (fixes .3). sort receivedAt desc + position/limit = newest-first + real pagination (fixes .2). Single stateless JSON response = no IMAP streaming/parse race (fixes .1 class-wide). No new npm deps (Bun global fetch). Auth: needs a Fastmail API token (Bearer) OR confirm existing app password works via Basic auth on JMAP endpoint -> the one open setup question. Deploy: /app/src is bind-mounted RO from checkout, not baked, so ships by editing .ts + recycling container (no image rebuild).

---
▸ 2026-08-23T18:37:55Z
Closed 2026-08-23: Joel validated fastmail-native (Fastmail's first-party MCP). Cross-folder/full-text need addressed by adopting the native MCP rather than building a primitive into our stdio server. Regrow if native search proves insufficient in practice.
