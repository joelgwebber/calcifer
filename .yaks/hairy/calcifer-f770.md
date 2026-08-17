---
id: calcifer-f770
title: Fold web-UI exposure topology into setup skill (Cloudflare Tunnel + tailnet
  serve)
type: task
priority: 4
created: '2026-08-17T18:31:40Z'
updated: '2026-08-17T18:43:23Z'
labels:
- web-ui
---

The public-exposure setup is install-specific and not reproduced by a fresh install: cloudflared --user service (EnvironmentFile=calcifer/.env.cloudflared, token), the tailscale-serve.conf drop-in (tailnet-only :443 / + /sms), and the CF Tunnel public-hostname (calcifer.j15r.com -> http://localhost:8787). Document/templatize in the setup skill so a reinstall reproduces it. Also note the gotcha that bit us: create a PUBLIC hostname (not a Private hostname — private = WARP-only, no public DNS) and set the origin as http:// (the app has no TLS; CF terminates it). Minor aside: hearth's own resolver can't resolve calcifer.j15r.com (Tailscale MagicDNS health warning) — cosmetic.
