---
id: calcifer-da67.1.1
title: Per-group credential file mounted into container
type: feature
priority: 1
created: '2026-03-08T21:01:15Z'
updated: '2026-04-19T00:17:16Z'
depends_on:
- calcifer-da67.3
commit: 9d10252
parent: calcifer-da67.1
---

Mount a per-group `credentials.env` file into each container instead of injecting
credentials as `-e KEY=VALUE` flags from a hardcoded list in `container-runner.ts`.

## Approach

Inspired by the Gmail skill's `~/.gmail-mcp` bind mount. Rather than reading a global
`.env` and passing a fixed list of vars, each group gets its own credential file:

```
data/credentials/{folder}.env   ← per-group, falls back to global if absent
```

Mounted read-only into the container at `/workspace/credentials.env`. The container
entrypoint sources it before starting the agent, so MCP servers find their vars in
`process.env` exactly as before — no changes needed to MCP server code.

## Implementation

1. **Dockerfile entrypoint**: add one line before `node`:
   ```bash
   [ -f /workspace/credentials.env ] && set -a && . /workspace/credentials.env && set +a
   ```

2. **container-runner.ts**: replace the hardcoded `readEnvFile([...])` + `-e KEY=VALUE`
   block with a single mount of the applicable `credentials.env` file.
   - If `data/credentials/{folder}.env` exists → mount it
   - Otherwise → mount the global `.env` (or an empty file for groups with no creds)

3. **Create credential files**: extract current global credentials into
   `data/credentials/main.env` (and later per-member files for family groups).

4. **Rebuild container image** (entrypoint change requires image rebuild).

## Benefits over old approach

- Adding a new MCP tool never requires touching `container-runner.ts`
- Per-group isolation is structural, not a list of overrides
- Credential files can be updated without restarting the service (hot-swap)
- Naturally extends to family group members: one file per person
- Skill gating falls out for free: absent credential → MCP server exits cleanly

## Supersedes

da67.4 (dynamic env-var passthrough) — the mount approach achieves the same goals
more cleanly and is closed alongside this yak.
