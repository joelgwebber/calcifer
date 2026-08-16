---
id: calcifer-7c3a.9
title: 'Web UI: public exposure via Tailscale Funnel + ops persistence'
type: task
priority: 2
created: '2026-07-28T20:22:03Z'
updated: '2026-08-16T19:26:15Z'
labels:
- web-ui
- ops
parent: calcifer-7c3a
---

---
▸ 2026-07-28T20:22:21Z
Ground truth (2026-07-28): web adapter binds *:8787 (all ifaces) inside calcifer.service (Restart=always), already reachable over tailnet at hearth:8787. Auth (src/channels/web-auth.ts) is fully built for open-web: scrypt pw + HMAC session cookie + per-handle rate-limit/lockout, owner-provisioned accounts only (no open signup), Secure-cookie gated on WEB_UI_SECURE_COOKIE. Tailscale 1.98.4 installed; hearth (100.100.128.96, hearth.hamlet-algol.ts.net) is Funnel-eligible (ACL allows it; sibling sparky already funnels :8080).

---
▸ 2026-07-28T20:22:21Z
Done: enabled Funnel on hearth 443 -> 127.0.0.1:8787 via 'tailscale funnel --bg --https=443 8787' (persisted in tailscaled state; survives reboot; keeps existing /sms -> :8767). Verified public: https://hearth.hamlet-algol.ts.net/ serves app shell 200; /api/me and /api/threads reject unauthenticated (401). Hardened: appended WEB_UI_SECURE_COOKIE=true to .env, restarted calcifer, gate re-verified.

---
▸ 2026-07-28T20:22:21Z
OPEN / decisions for owner: (1) Funnel ingress is owned by tailscaled, NOT calcifer.service — good for resilience but not captured in repo/setup. Decide: document-only vs. add to setup skill vs. a systemd oneshot to assert funnel on boot. (2) URL is the *.ts.net name; decide whether a friendlier custom domain is wanted (Funnel only serves the ts.net name; a custom domain needs a separate reverse proxy + port-forward, a bigger lift). (3) tailscale reports a DNS health warning ('can't reach configured DNS servers') — cert issuance + curl succeeded, so non-blocking, but worth a look. (4) Optional: bind app to 127.0.0.1 instead of * since Funnel is the only public ingress.

---
▸ 2026-08-15T04:22:03Z
DONE (tie-to-service): web server already runs inside calcifer (web adapter :8787, under calcifer.service). Tied the Tailscale ingress to the service via a systemd drop-in ~/.config/systemd/user/calcifer.service.d/funnel.conf with 3 idempotent ExecStartPost lines (leading '-', no teardown on stop). Verified self-heal: wiped hearth's full serve+funnel topology, restarted calcifer, all mounts rebuilt automatically.

---
▸ 2026-08-15T04:22:03Z
TOPOLOGY CHANGE + security fix: discovered Tailscale funnel is a whole-:443 toggle — can't have / public and /sms private on the same port. Since the /sms webhook (sms-android.ts) is UNAUTHENTICATED, my earlier 'funnel :443' had made it publicly POSTable (fake-SMS injection risk). Fixed: :443 stays tailnet-only (/ web + /sms private; phone posts over tailnet), web UI now public via Funnel on :8443. NEW public URL: https://hearth.hamlet-algol.ts.net:8443/ (the bare :443 public URL from earlier is now tailnet-only). Also set WEB_UI_SECURE_COOKIE=true (TLS) earlier.

---
▸ 2026-08-15T04:22:03Z
OPEN follow-ups: (1) drop-in + .env are install-specific (not in repo); fold into setup skill/template so a fresh install reproduces the :443-serve + :8443-funnel topology. (2) Optional: to reclaim clean :443 for the public web URL, add a shared-secret/header check to the /sms webhook so it can safely be funnelled (needs sms-android.ts change + phone gateway reconfig) — separate yak if wanted. (3) DNS health warning on tailscaled still unexplained (non-blocking). (4) provision family web accounts (scripts/web-user.ts).

---
▸ 2026-08-16T19:26:15Z
CUSTOM DOMAIN PLAN (addresses this yak's open item #2 — replace the long *.ts.net funnel URL with a friendly custom domain).

APP-SIDE: essentially NO code changes needed. Verified this session: web binds :8787 on all interfaces; API + SSE are same-origin; SPA history fallback exists (web.ts:580 serves index.html for unknown paths); auth is client-side + path-preserving (deep links survive login); Secure cookie works on HTTPS; permissive CORS; no Host-header/absolute-URL construction anywhere. So a reverse proxy/tunnel that fronts the same origin (/ + /api + /api/stream) just works with relative links. No WEB_UI_PUBLIC_URL needed unless/until we emit ABSOLUTE cross-channel links (deferred).

OPS-SIDE (the actual work): add a reverse proxy/tunnel for the custom domain -> 127.0.0.1:8787, SSE-safe (no buffering), persisted across reboot (systemd, like the funnel drop-in). No installed proxy today (no cloudflared/caddy/nginx).

APPROACH OPTIONS:
- A. Cloudflare Tunnel (cloudflared) — RECOMMENDED for a headless home box: no port-forward, works behind NAT/CGNAT, free, custom domain + TLS handled by CF, supports SSE. Needs: domain on Cloudflare DNS + a tunnel token (headless: token from CF dashboard, not interactive browser login). Tradeoff: CF terminates TLS (sees plaintext) — acceptable for a family app.
- B. Caddy (or nginx) + port-forward 443 + A/AAAA record — fully self-hosted, auto Let's Encrypt. Needs a reachable public IP and open inbound 443; breaks under CGNAT (likely on home ISP).
- C. Reverse proxy on a cheap public VPS, proxying over Tailscale to hearth — works behind CGNAT, self-hosted-ish, but costs a VPS + more moving parts.

DECISIONS NEEDED FROM OWNER:
1. Approach (A/B/C). Recommend A unless hearth has a non-CGNAT public IP + can port-forward 443.
2. The domain (owner providing) + registrar/DNS (CF-managed for approach A).
3. Credential: cloudflared tunnel token (approach A).
4. Keep tailnet-only :443 for internal + funnel :8443 as fallback, or make the custom domain canonical and retire the funnel?
5. SSE passthrough to be verified through the chosen proxy after setup.

IMPLICATION for 678d: none blocking — deep links are relative + login is client-side, so shared links are domain-portable and already survive login (see 678d note).
