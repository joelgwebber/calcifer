# Calcifer — Fork Operations

Operational knowledge specific to **this** install (the `calcifer` fork of NanoClaw).
Upstream architecture lives in `CLAUDE.md` (symlinked as `AGENTS.md`) and `docs/`; this
file is the fork-owned companion for running the thing day to day — the `ncl` CLI, where
config actually lives, how to make changes take effect, recipes, and the gotchas we've hit.

> Maintained by us, never by upstream. Safe to edit freely; it won't merge-conflict.

---

## Load-bearing rules (read these first)

1. **`container.json` is DERIVED, never a source.** The source of truth is the
   `container_configs` table in `data/v2.db`. `materializeContainerJson()`
   (`src/container-config.ts`) rewrites `groups/<folder>/container.json` from the DB on
   **every spawn**. Hand-edits are silently overwritten. Change config via
   `ncl groups config …`, not the file.
2. **`ncl groups restart` only recycles RUNNING containers.** It cannot cold-start a group
   (`src/container-restart.ts` filters to `isContainerRunning`). A cold group spawns only on
   a real inbound message. `--message` respawn also only fires for already-running sessions.
3. **Match the change to the lever** (see the table below): source edits → recycle a
   container; host code → restart the service; dependencies/Dockerfile → rebuild the image.
4. **MCP-server credentials live in the DB** (env for stdio, headers for http), as plaintext
   in `container_configs.mcp_servers`. OneCLI is *not* on the path for our MCP servers.
5. **Zed loads exactly one rules file.** Here that's `AGENTS.md → CLAUDE.md`. Do **not** add a
   `.rules` file — it outranks `AGENTS.md` and would replace the upstream doc in context.

---

## The three layers and their levers

There are three independent layers, each updated a different way. Getting this wrong is the
usual reason "my change didn't take."

| What you changed | `./container/build.sh`? | Restart host service? | Recycle container? |
|---|:--:|:--:|:--:|
| MCP server / agent-runner source (`container/agent-runner/src/**`) | No | No | **Yes** |
| A container skill (`container/skills/**/SKILL.md`) | No | No | **Yes** |
| Group config (MCP servers / env / mounts, via `ncl groups config`) | No | No | **Yes** |
| Host code (`src/**`: router, delivery, sweep, adapters) | No | **Yes** — `pnpm run build` first | No |
| Added/bumped an agent-runner dep (`package.json` + `bun.lock`) | **Yes** | No | Yes |
| Dockerfile / baked CLI / apt package | **Yes** | No | Yes |

Why: the agent-runner source (`/app/src`) and container skills (`/app/skills`) are **bind-mounted
read-only from the checkout at spawn** (`src/container-runner.ts`, `buildMounts`) — not baked into
the image. Only `/app/node_modules` and baked CLIs live in the image. So a pure source edit ships
by recycling a container; only dependency/Dockerfile changes need `build.sh`.

### "Recycle a container" = get a fresh spawn

A fresh spawn re-reads the mounted source **and** re-materializes `container.json` from the DB.
Two ways:

- **Send the group a message** (any inbound message triggers `router → spawnContainer`). This is
  the only way to start a **cold** group.
- **`./bin/ncl groups restart --id <group-id>`** — but only if a container is **already running**
  (it recycles running ones; on a cold group it returns `restarted: 0` and does nothing).
  Add `--message "…"` to respawn immediately with a prompt; without it, running containers come
  back on the next message.

### Restart the host service

The systemd service runs **compiled** `dist/index.js` (`ExecStart=node …/dist/index.js`), so a
host-code change under `src/**` must be **compiled first** — a bare restart reruns stale `dist/`:

```bash
pnpm run build                     # tsc: src/ -> dist/  (REQUIRED for any src/** change)
# Linux (systemd)   — this install
systemctl --user restart calcifer
# macOS (launchd)
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

Note: a host restart does **not** recycle agent containers — on shutdown it leaves them running,
and on startup `adoptRunningSessions()` re-adopts the live ones. So host-code changes are live for
the host immediately, but anything already loaded inside a running container stays until that
container is recycled.

### Rebuild the image

```bash
./container/build.sh          # rebuilds nanoclaw-agent image (deps + baked CLIs)
```
Only needed for dependency/Dockerfile/apt changes. Buildkit caches COPY aggressively; a truly
clean rebuild needs a builder prune first (but that only matters for *baked* content — mounted
source/skills are never affected).

---

## Config is DB-sourced

- Source of truth: `container_configs` table in `data/v2.db` (per agent group).
- `groups/<folder>/container.json` is a spawn-time artifact, rewritten from the DB each spawn.
- That's why `dm-with-alicia` and `the-hearth` may have **no** `container.json` — they simply
  haven't spawned since theirs was last written; their config still lives in the DB.
- Inspect/change via `ncl` (below). For raw central-DB queries:
  `pnpm exec tsx scripts/q.ts data/v2.db "select ..."`.

---

## `ncl` CLI cheat-sheet

Run on the **host** as `./bin/ncl …` (or `pnpm ncl …`). Model: `ncl <resource> <verb> [id] [--flags]`.
`ncl help` / `ncl <resource> help` for details.

```bash
./bin/ncl groups list                                   # agent groups (id, name, folder)
./bin/ncl groups get --id <group-id>
./bin/ncl groups config get --id <group-id>             # effective container config (from DB)
./bin/ncl groups config update --id <group-id> --model … --timezone …
./bin/ncl groups config add-mcp-server --id <group-id> --name <n> …     # see MCP recipes
./bin/ncl groups config remove-mcp-server --id <group-id> --name <n>
./bin/ncl groups restart --id <group-id> [--message "…"]  # recycle RUNNING containers only
./bin/ncl sessions list                                  # sessions + container_status
./bin/ncl destinations list --id <group-id>
./bin/ncl members list --id <group-id>
./bin/ncl tasks list --id <group-id>
```

Common resources: `groups`, `messaging-groups`, `wirings`, `users`, `roles`, `members`,
`destinations`, `sessions`, `tasks`, `user-dms`, `dropped-messages`, `approvals`.

**This install's groups** (ids are install-specific — confirm with `groups list`):

| Group | Folder | agent_group_id |
|---|---|---|
| Calcifer (DM w/ Joel) | `dm-with-joel` | `ag-1777141351652-tx7j2h` |
| Calcifer (DM w/ Alicia) | `dm-with-alicia` | `ag-1777142047617-ue4hdh` |
| The Hearth | `the-hearth` | `ag-1779841737002-18051a` |

---

## MCP servers

Config shape (`container_configs.mcp_servers`, materialized into `container.json`):

- **stdio** (in-tree servers run by Bun): `{ "command": "bun", "args": ["/app/src/<x>-mcp-stdio.ts"], "env": { … } }`
- **http** (remote MCP): `{ "type": "http", "url": "https://…", "headers": { "Authorization": "Bearer …" } }`

The stack supports remote HTTP MCP end to end: `McpServerConfig` has the `http` variant,
`resolvePluginServer` + `shimCwd` pass it through, and `ClaudeProvider` allow-lists
`mcp__<name>__*` and forwards it to the Claude Agent SDK. So adding a remote MCP server is
**config only** — no code, no dep, no image rebuild; just recycle.

Tools are namespaced `mcp__<server-name>__<tool>`.

---

## Recipes

**Add a remote (HTTP) MCP server** — e.g. Fastmail's native MCP:
```bash
./bin/ncl groups config add-mcp-server \
  --id ag-1777141351652-tx7j2h \
  --name fastmail-native \
  --url https://api.fastmail.com/mcp \
  --headers '{"Authorization":"Bearer <TOKEN>"}'
# then recycle: send the group a message (cold), or `groups restart` (if running)
```
(The command is approval-gated; as owner you approve it. The token persists in the DB and is
materialized into `container.json` on the next spawn.)

**Add a stdio MCP server:**
```bash
./bin/ncl groups config add-mcp-server --id <group-id> --name <n> \
  --command bun --args '["/app/src/<n>-mcp-stdio.ts"]' --env '{"<N>_TOKEN":"…"}'
```

**Rotate a token:** re-run `add-mcp-server` with the same `--name` (overwrites), then recycle.
Do **not** edit `container.json` — it will be overwritten from the DB.

**Make an agent-runner / skill source edit live:** save the file, then recycle a container
(message the group, or `groups restart` if one is running). No build, no host restart.

**Find state fast:**
```bash
docker ps --format '{{.Names}}\t{{.Status}}'      # running agent containers (naming: nanoclaw-v2-…, ncl-…)
./bin/ncl sessions list                            # sessions + container_status
```

**Logs:** `logs/calcifer.error.log` first (delivery/crash/warnings), then `logs/calcifer.log`
(full routing chain). Setup: `logs/setup.log`, `logs/setup-steps/*.log`. Session DBs:
`data/v2-sessions/<agent-group>/<session>/{inbound,outbound}.db`. Container logs are lost on exit
(`--rm`).

---

## Secrets / OneCLI

- For our MCP servers, the credential goes in the **DB** (stdio `env`, http `headers`) and is
  materialized into `container.json`. Plaintext on disk (RO-mounted into the container) — same
  posture as everything else. Prefer scoped, revocable tokens.
- **OneCLI** is a transparent `HTTPS_PROXY` that injects credentials for *connected apps* at the
  proxy boundary. It's great for the agent making direct API calls, but finicky for a stdio MCP
  server doing a raw `fetch` (needs the app connected, host-pattern match, and the client honoring
  the proxy). That's the source of past "credential not injected" debugging. For MCP servers, the
  env/header token path is the reliable one.

---

## Fastmail (current state)

- **stdio server** `container/agent-runner/src/fastmail-mcp-stdio.ts` (IMAP/SMTP/CalDAV/CardDAV),
  wired as MCP server `fastmail` → `mcp__fastmail__*`. Track A reliability fixes applied:
  `list_messages` now awaits all `simpleParser` promises before resolving (fixes non-deterministic
  result counts) and sorts newest-first (fixes recent mail hidden for prolific senders).
- **JMAP** needs a **Bearer API token** (app password → `401 "not bearer"` on
  `api.fastmail.com/jmap`). A hand-rolled thin JMAP client is the parked fallback.
- **Fastmail native MCP** at `https://api.fastmail.com/mcp` — Streamable-HTTP, Bearer, scope
  `https://www.fastmail.com/dev/mcp`. Wired as `fastmail-native` (`type:http`) →
  `mcp__fastmail-native__*`. Being evaluated as the primary path (first-party, config-only).
- Tracking: yak `calcifer-569e` (+ children).

---

## Gotchas log

- **2026-08-23** — The host service runs **compiled `dist/`** (`ExecStart=node dist/index.js`). A host-code change (`src/**`) needs `pnpm run build` **before** `systemctl --user restart calcifer` — a bare restart reruns stale compiled code. (Agent-runner/container source is bind-mounted, so it needs only a container recycle, no build.)
- **2026-08-23** — Web UI showed ~20 phantom messages (all attributed to the user) on every thread: `web-history.ts` read `messages_in` filtered only by `kind`, so cross-session-context echo rows (`channel_type='session-echo'`, `kind='chat'`) leaked into the transcript. Fixed by scoping to `channel_type='web'`. Yak `calcifer-3779`.
- **2026-08-23** — `container.json` is derived from the DB; hand-edits (incl. a pasted token) are
  wiped the next time the group spawns. Use `ncl groups config …`.
- **2026-08-23** — `ncl groups restart` returns `restarted: 0` on a cold group; it only recycles
  running containers. Send the group a message to cold-start.
- **2026-08-23** — Fastmail app password returns `401` on JMAP; JMAP requires a Bearer API token.
- **2026-08-23** — Adding a remote MCP server is config-only (`type:http`) — the stack forwards it
  to the Claude Agent SDK; no code/dep/rebuild.
- **2026-08-23** — Zed auto-loads a single rules file (`AGENTS.md → CLAUDE.md`); adding `.rules`
  would supersede it. Keep fork notes here + a fenced pointer in `CLAUDE.md`.
