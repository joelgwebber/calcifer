---
id: calcifer-569e.1
title: 'fastmail_list_messages: non-deterministic pagination drops known messages'
type: bug
priority: 2
created: '2026-08-23T15:06:35Z'
updated: '2026-08-23T15:16:11Z'
labels:
- fastmail
- mcp
- reliability
source: 'Joel + Calcifer investigation, 2026-08-23: chasing why an email from Alicia
  (''Table'' subject) didn''t surface in an earlier search thread'
parent: calcifer-569e
---

Identical fastmail_list_messages calls (same folder/filters/limit) return different, sometimes incomplete result sets between calls. Reproduced directly: two consecutive identical unfiltered INBOX listings returned 21 then 15 messages, with a previously-found message ('College lists', UID 99190) dropping out of the smaller result. Also seen on Archive: identical unfiltered listing calls at the same limit returned 0, then 54, then 0, then 95, then 98, then 100 results across successive calls. This is a live reliability defect in the Fastmail MCP server/tool itself, not a query-construction bug. Likely root cause: IMAP session/connection state not being consistently established or a race in how results are paginated/fetched before the tool returns.

---
▸ 2026-08-23T15:16:11Z
Root cause: fastmail_list_messages used simpleParser(stream, cb) (async, fire-and-forget) and resolved in fetch.once('end') before parse callbacks completed, also calling imap.end() mid-parse. Fixed by collecting a promise per body parse (simpleParser(stream) promise form) and awaiting Promise.all(parses) before imap.end() + resolve. Deterministic full result set now. tsc: no new errors.
