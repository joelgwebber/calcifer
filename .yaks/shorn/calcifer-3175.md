---
id: calcifer-3175
title: fastmail read_message uses IMAP sequence numbers instead of UIDs
type: task
priority: 3
created: '2026-06-16T15:46:18Z'
updated: '2026-06-24T16:20:00Z'
---

list_messages was storing seqno (IMAP sequence number) as the message uid. Sequence numbers change between connections, causing read_message to fetch the wrong email. Fix: capture attrs.uid from the attributes event in list_messages, and in read_message do a UID search to resolve to the current seqno before fetching. Fixed in canonical source and joel session overlay; needs container rebuild to fully take effect.

**Shorn 2026-06-24:** canonical fix committed to `container/agent-runner/src/fastmail-mcp-stdio.ts` (commit a9a9be8, `fix(mcp): ...`). Container rebuild still required to deploy.
