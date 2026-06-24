---
id: calcifer-7c3a.3
title: 'Web UI: attachments / media (inbound upload + outbound files)'
type: task
priority: 3
created: '2026-06-13T12:00:00Z'
updated: '2026-06-13T12:00:00Z'
---

PARENT YAK: calcifer-7c3a

Embed images and files in both directions.

## Outbound (agent → user)

- Delivery already hands `OutboundFile[]` (filename + Buffer) to `adapter.deliver`
  (delivery.ts reads them from the session outbox). The web adapter currently
  drops them (text-only slice).
- Plan: write file bytes to a short-lived host-served location (or stream from
  the outbox), push an SSE `message` whose parts include image/file references
  (URLs into a new `GET /api/attachment/:id` byte endpoint). Map to assistant-ui
  Image / File message parts.

## Inbound (user → agent)

- Implement an assistant-ui AttachmentAdapter (presigned-URL style) that POSTs
  the file to a host endpoint; the host stages it into the session inbox and
  includes a reference in the inbound message content (`content.attachments`),
  matching how native adapters surface inbound media (see router
  writeSessionMessage → extractAttachmentFiles).
- Verify how the container agent currently consumes inbound attachments so the
  reference shape matches.

## Notes

- Keep the byte endpoint scoped/auth, especially once 7c3a.6 lands.
- CJK/large-file considerations are out of scope here.
