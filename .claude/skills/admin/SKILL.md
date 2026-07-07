---
name: admin
description: Admin cookbook for host-side operational tasks — provision/manage web users, run ad-hoc DB queries, inspect/close sessions, wire messaging groups, manage shared skill data + skill views, restart the service. Use when performing nanoclaw administration from the host shell (not inside a container).
---

# NanoClaw Admin Cookbook

A catalog of the small operational tasks that don't have a dedicated skill. Two
first-class surfaces:

- **`ncl`** — the structured admin CLI for central-DB resources (agent groups,
  messaging groups, wirings, users, roles, members, destinations, sessions).
  Prefer this for anything it covers. `ncl help`, `ncl <resource> help`.
- **`scripts/`** — reusable tsx/sh tools for bootstrap/one-off tasks.

Run everything below from the project root on the host. For ad-hoc SQL use the
in-tree wrapper, never the `sqlite3` binary:

```bash
pnpm exec tsx scripts/q.ts <db-path> "<sql>"
```

Key DBs: central `data/v2.db`; per-session `data/v2-sessions/<agent-group>/<session>/{inbound,outbound}.db`.

## Web users (login to the web UI)

Owner-provisioned only; no open signup. Each user maps to `web:<handle>` → a
per-user messaging group `web:<handle>` wired to one agent group.

```bash
# Provision (prints a generated password to hand off):
pnpm exec tsx scripts/web-user.ts add --handle alice --display-name "Alice" \
    --agent-group <AGENT_GROUP_ID> --role member --generate
# List / rotate / disable:
pnpm exec tsx scripts/web-user.ts list
pnpm exec tsx scripts/web-user.ts set-password --handle alice --generate
pnpm exec tsx scripts/web-user.ts remove --handle alice     # disables login, keeps threads
```

Find an agent group id: `ncl groups list`. Users log in at the web UI
(`http://<host>:8787`, or behind TLS for the open web — see the auth notes in
`src/channels/web-auth.ts`).

> Follow-up: graduate this into an `ncl web-users` resource so it's first-class.

## Sessions (web chat threads live here)

```bash
# Sessions for a messaging group (spot orphans/duplicates):
pnpm exec tsx scripts/q.ts data/v2.db \
  "SELECT id, agent_group_id, thread_id, status, created_at FROM sessions WHERE messaging_group_id='<MG_ID>'"
# Close an orphaned/stale session (e.g. left behind after re-pointing a wiring):
pnpm exec tsx scripts/q.ts data/v2.db "UPDATE sessions SET status='closed' WHERE id='<SESSION_ID>'"
```

The web chat thread list + history are scoped to the messaging group's *current*
agent group (`src/channels/web-history.ts`). If a web user is re-pointed to a new
agent group, close the old agent group's sessions for that mg to avoid clutter.

## Wiring a web user to a different agent group

`web:<handle>`'s messaging group is `web:<handle>`. Re-point it via `ncl`:

```bash
ncl wirings list                       # find the mg's wiring id
ncl wirings delete <MGA_ID>            # remove old wiring
ncl wirings create --messaging-group-id <MG_ID> --agent-group-id <AG_ID> \
    --engage-mode pattern --engage-pattern . --session-mode per-thread
```

`ncl` auto-creates the agent's reply destination on wiring. (Data caveat: a
skill's per-agent data — e.g. nyc-apt's DB — lives in the *old* agent's
workspace unless it's a shared-scope skill; see below.)

## Shared skill data + skill views (1d51)

- A skill's family-shared data lives under **`data/shared/<skill>/`** (the
  canonical operational dir; NOT `store/`, which is v1 legacy). It's mounted RW
  into the relevant agent(s) at `shared/<skill>` (→ `/workspace/extra/shared/<skill>`)
  and read read-only by the host view plane.
- A **view** is a static `container/skills/<skill>/view.json` manifest; the host
  serves it at `/api/views/<view>` with `data.scope: "agent" | "shared"`.
- **Shared annotations** (stars/notes) are host-owned, family-wide, in the
  central-DB `annotations` table (`src/db/annotations.ts`).
- Single-writer rule: exactly one agent writes a skill's DB; the host only reads
  it. Never host-write a skill DB while its container may be running.

Relocating a skill to shared: copy its data dir → `data/shared/<skill>/`; add a
RW mount to the writer agent's `container_configs.additional_mounts`; repoint the
monitor's scheduled task (`kind='task'` row in the session `inbound.db`, JSON
`content.script`) to `NYC_APT_DIR=/workspace/extra/shared/<skill> node
/app/skills/<skill>/check.mjs`; set the manifest `data.scope="shared"`.

## Service control (Linux/systemd)

```bash
pnpm run build                                  # compile host TS -> dist/
systemctl --user restart calcifer               # restart the host
systemctl --user is-active calcifer
journalctl --user -u calcifer -n 100 --no-pager # or logs/nanoclaw.log
```

A manifest/view change or new endpoint needs a rebuild + restart. Session/DB
edits are picked up live.

## Gotchas

- `git add`ing a nonexistent path aborts the whole `git add` (stages nothing) —
  don't include speculative `.yaks/hairy/<id>.md` paths that were never committed.
- WhatsApp auth currently lives in `store/auth` (Baileys session); don't delete
  `store/` until that's migrated + re-paired (tracked in a yak).
