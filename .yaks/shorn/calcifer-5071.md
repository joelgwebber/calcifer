---
id: calcifer-5071
title: Setup HTTPS reverse proxy for Open WebUI PWA support
type: feature
priority: 2
created: '2026-03-07T21:12:56Z'
updated: '2026-03-08T17:11:05Z'
commit: ded9e57
---

Configure HTTPS reverse proxy for Open WebUI to enable proper PWA installation on mobile devices.

PROBLEM:
Open WebUI currently accessible via HTTP (localhost:3001 or similar), which prevents PWA installation. Browser treats it as bookmark that opens new tab instead of standalone app.

PWA REQUIREMENTS:
- HTTPS required for PWA installation
- Standalone app window (not browser tabs)
- Offline functionality
- Native app-like experience on mobile

SOLUTION: HTTPS Reverse Proxy

OPTIONS:

Option A: Caddy (Recommended - Easiest)
- Automatic HTTPS with Let's Encrypt
- Simple configuration
- Built-in reverse proxy
- Auto certificate renewal

Caddyfile example:


Option B: Nginx + Certbot
- More complex setup
- Manual certificate management
- Industry standard, very stable
- Better for multiple services

nginx.conf example:


Option C: Traefik
- Docker-native
- Automatic service discovery
- Good for containerized environments

IMPLEMENTATION STEPS:

1. Choose reverse proxy (recommend Caddy for simplicity)
2. Install reverse proxy on host
3. Configure domain DNS (A record or CNAME)
4. Configure reverse proxy to:
   - Listen on 443 (HTTPS)
   - Obtain Let's Encrypt certificate
   - Proxy to localhost:3001 (Open WebUI)
5. Test HTTPS access
6. Test PWA installation on iOS/Android

MOBILE INSTALLATION AFTER HTTPS:

iOS (Safari):
1. Open https://nanoclaw.yourdomain.com in Safari
2. Tap Share button
3. Select "Add to Home Screen"
4. Opens as standalone app

Android (Chrome):
1. Open https://nanoclaw.yourdomain.com in Chrome
2. Tap three-dot menu
3. Select "Add to Home screen"
4. Gets app icon and standalone window

DEPENDENCIES:
- Domain name (see related yak for Tailscale domain)
- DNS configuration
- Port 80/443 accessible
- SSL certificate (auto via Let's Encrypt)

BENEFITS:
- Real PWA installation
- No more browser tabs for each visit
- Offline functionality
- Native app feel
- Background sync
- Push notifications (if implemented)

RELATED YAK:
Depends on domain setup with Tailscale (see companion yak)
