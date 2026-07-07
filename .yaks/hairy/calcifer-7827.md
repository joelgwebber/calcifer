---
id: calcifer-7827
title: Promote Calcifer host from user service to system-level service
type: task
priority: 3
created: '2026-07-04T16:58:25Z'
updated: '2026-07-04T16:58:25Z'
labels:
- ops
- infra
- reliability
---

Calcifer's host runs as a per-USER systemd service (calcifer.service under user@1000). On 2026-07-04 this caused a ~13.5h outage: with Linger=no, the user manager (and Calcifer) is torn down when Joel's last SSH/login session ends. Session dropped ~23:10, host stayed down until login at 12:39 next day; machine never slept/rebooted (4-day continuous uptime). Stopgap applied: 'loginctl enable-linger joel' — keeps the user manager alive across logouts. This yak tracks the more robust follow-up: promote the host to a root/system-level systemd unit so it's fully independent of Joel's account and login lifecycle.

Why bother (vs. linger): linger keeps it up across logouts but is still user-scoped state that can be lost (user account changes, linger getting disabled, home-dir/session quirks). A system service is the canonical always-on model.

Scope / gotchas to work through when promoting:
- New unit at /etc/systemd/system/calcifer.service (root), WantedBy=multi-user.target, enable so it survives reboot.
- Ownership/permissions: it still needs to run as (or on behalf of) joel for Docker access, OneCLI vault, and all the /home/joel paths (session DBs data/v2-sessions, groups/, logs/). Likely User=joel / Group=joel or an equivalent, plus correct HOME and XDG_RUNTIME_DIR.
- Docker: currently 'docker run' talks to the daemon reachable from joel's session. Confirm the socket/context works under the system unit (rootful daemon at /var/run/docker.sock vs rootless in the user session). Container name prefix + orphan cleanup (container-runtime.ts) must still line up.
- OneCLI gateway: the proxy runs as its own containers (onecli / onecli-postgres, currently Up as system-ish). Ensure the CA cert paths (/tmp/onecli-*.pem) and gateway host (host.docker.internal:10255) still resolve when the host runs as a system service.
- Node/pnpm runtime path: unit currently uses joel's nvm node (/home/joel/.nvm/.../node dist/index.js). A system unit should pin an absolute node path or use the install's expected runtime.
- Install-slug tooling: setup/lib/install-slug.sh + the launchd/systemd unit generation assume the user-service model; check whether a system-service path is supported or needs a setup change (possibly an upstream-worthy improvement / skill).
- Migration steps: disable-linger (optional), 'systemctl --user disable --now calcifer', install + enable system unit, verify no double-instance (EADDRINUSE :3000 / Telegram getUpdates conflict were seen when two hosts overlapped), confirm delivery end-to-end.
- Decide: keep it single-user-owned (User=joel) which is simplest, or fully root-managed. Single-user-owned is probably the right balance.

Not urgent — linger is a working stopgap. Revisit when doing reliability/hardening pass.
