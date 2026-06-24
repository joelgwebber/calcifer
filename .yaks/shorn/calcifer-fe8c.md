---
id: calcifer-fe8c
title: 'Fastmail read_message: add attachment extraction support'
type: enhancement
priority: 3
created: '2026-06-16T15:47:26Z'
updated: '2026-06-16T15:51:49Z'
---

The read_message tool returns text/HTML body only. PDFs and other attachments are silently dropped. Need to either return attachment metadata+download URLs, or add a separate fastmail_get_attachments tool.
