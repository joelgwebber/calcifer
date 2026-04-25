---
id: calcifer-7282
title: Add Open WebUI as web interface for NanoClaw
type: feature
priority: 3
created: '2026-03-05T04:18:04Z'
updated: '2026-03-08T15:45:04Z'
commit: 1bed0c3
---

Add Open WebUI as an optional web-based chat interface for NanoClaw, providing a ChatGPT-like experience in the browser.

## What is Open WebUI?

Self-hosted web-based chat interface for AI models. Think "ChatGPT's interface, but self-hosted and model-agnostic."

**Key features**:
- Familiar ChatGPT-like interface
- Docker one-liner install
- Supports multiple AI providers (OpenAI, Claude, Ollama, etc.)
- Built-in RAG for document chat
- Multi-user support with auth
- PWA for mobile (install to home screen)
- Can run 100% offline with local models

**2026 status**: "One of the most widely adopted self-hosted AI chat platforms"

## Why Add It?

**Complements Telegram**:
- Telegram: Best for mobile, notifications, quick interactions
- Open WebUI: Best for desktop, longer conversations, document chat

**Use cases**:
- Family members who prefer web interface over messaging apps
- Desktop users who want ChatGPT-style interface
- Document analysis with built-in RAG
- Multi-user access (multiple family members)

## Architecture

**Option 1: Standalone** (simpler)
- Run Open WebUI pointing to Claude API directly
- Separate from NanoClaw agents
- No shared context with Telegram

**Option 2: Integrated** (more complex)
- Open WebUI → NanoClaw API → Agent containers
- Shared context with Telegram
- Requires NanoClaw HTTP API endpoint

## Implementation

**Quick start (Option 1)**:
```bash
docker run -d -p 3000:8080 ghcr.io/open-webui/open-webui:main
```

Then configure with Claude API key.

**Full integration (Option 2)**:
- Create HTTP API endpoint in NanoClaw (REST or WebSocket)
- Configure Open WebUI to use NanoClaw as backend
- Share agent context between Telegram and web UI
- Requires custom Open WebUI model provider

## Priority

**P3** - Nice-to-have after Telegram is working. Telegram might be sufficient for most use cases.

## References

- Open WebUI: https://openwebui.com/
- GitHub: https://github.com/open-webui/open-webui
- 2026 research shows it's the de facto standard for self-hosted AI chat UIs
