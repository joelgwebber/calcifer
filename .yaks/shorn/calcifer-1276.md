---
id: calcifer-1276
title: Internal /app links in chat should navigate in-window, not open a new tab
type: bug
priority: 3
created: '2026-08-16T19:18:46Z'
updated: '2026-08-16T19:19:15Z'
parent: calcifer-7c3a
labels:
- ui
---

Record cards route internally (react-router Link, same window), but inline markdown links to /app/<view>/<id> in chat open a NEW tab — because chat Prose (d1f8) has no onNavigate wired, so Prose's relative-link branch falls back to target=_blank. Fix: pass a nav.onNavigate to the chat's Prose that navigates internal (leading-'/') hrefs via useNavigate, matching card behavior; external links keep opening in a new tab. web/src/ui/Thread.tsx MarkdownText.

---
▸ 2026-08-16T19:19:15Z
Fixed. Chat MarkdownText now passes nav.onNavigate to Prose: internal ('/'-prefixed) hrefs route via react-router useNavigate in the same window (parity with record cards); external links keep Prose's new-tab behavior. Frontend-only; build clean; browser reload to pick up.
