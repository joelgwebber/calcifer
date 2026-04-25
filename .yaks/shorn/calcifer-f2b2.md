---
id: calcifer-f2b2
title: Setup public domain on Tailscale with Funnel for internet access
type: feature
priority: 2
created: '2026-03-07T22:03:27Z'
updated: '2026-03-08T15:45:08Z'
commit: 1bed0c3
---

Configure public domain to expose NanoClaw via Tailscale Funnel with automatic HTTPS.

GOAL: Access via https://nanoclaw.yourdomain.com from public internet (not just Tailscale network).

RECOMMENDED APPROACH: Tailscale Funnel
- Exposes port to public internet
- Automatic HTTPS via Tailscale certificates
- Free on personal tier
- No reverse proxy needed

STEPS:
1. Enable Funnel: tailscale funnel --bg 3001
2. Get assigned URL: https://hostname.tail-scale.ts.net
3. Buy domain (~0-15/year)
4. Add CNAME: nanoclaw.yourdomain.com to hostname.tail-scale.ts.net
5. Wait for DNS propagation
6. Test public HTTPS access

BENEFITS:
- Public internet access (not VPN-only)
- Automatic HTTPS via Tailscale
- No firewall port opening needed
- Works with custom domain

COST: Domain only (~5/year), Tailscale Funnel free

Blocks calcifer-5071 (need domain for reverse proxy PWA setup)
