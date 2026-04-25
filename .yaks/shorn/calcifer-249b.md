---
id: calcifer-249b
title: 'OneCLI migration: align credential system with upstream'
type: feature
priority: 2
created: '2026-04-25T14:53:20Z'
updated: '2026-04-25T18:18:05Z'
---

Migrate from the native credential proxy to OneCLI Agent Vault to stay aligned with upstream NanoClaw direction.

CONTEXT:
- We currently use the built-in credential-proxy.ts (HTTP proxy, .env-based)
- Upstream is firmly heading toward OneCLI as the primary credential system
- OneCLI is fully open source (https://github.com/onecli/onecli), runs locally via Docker Compose or native binary, uses Postgres + Rust gateway + Next.js dashboard
- Architecturally similar to our native proxy (HTTP-level URL rewriting, not HTTPS interception) but adds: web dashboard, PostgreSQL vault, Bitwarden integration, per-agent policies (roadmap)

GOALS:
- Run OneCLI locally as part of the Calcifer service stack (systemd unit or launchd plist)
- Migrate Anthropic credentials from .env to OneCLI vault
- Preserve per-family-member credential differentiation (maps to OneCLI per-agent identity)
- Keep family group structure intact; adapt credential scoping to fit OneCLI model

NON-GOALS:
- Don't need cloud account or Bitwarden integration immediately
- Per-agent policies are OneCLI roadmap, not needed now

CHILD TASKS to create:
1. Install and run OneCLI locally (Docker Compose or native)
2. Wire OneCLI into Calcifer service startup
3. Migrate .env Anthropic credentials to vault
4. Adapt per-group credential files (data/credentials/*.env) to OneCLI per-agent model
5. Update project container credential handling to match
