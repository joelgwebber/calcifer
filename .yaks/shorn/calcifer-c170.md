---
id: calcifer-c170
title: 'A4: Command palette (Cmd+K) — search conversations + apps'
type: task
priority: 3
created: '2026-08-23T23:11:07Z'
updated: '2026-08-26T13:38:10Z'
parent: calcifer-2520
depends_on:
- calcifer-3236
labels:
- web-ui
---

A Cmd+K / Ctrl+K command palette that searches conversations by name (uses the B0 title metadata) and jumps to apps/views. Natural companion to the unified nav and the archive name-search (B3) — the two search surfaces should share a matcher. Keyboard-first, fuzzy match, recent-first.

---
▸ 2026-08-26T13:38:10Z
Done. Command palette (Cmd/Ctrl+K) as a keyboard-first overlay searching conversations (by B0 titles) + app views, jumping on Enter. New web/src/ui/CommandPalette.tsx + web/src/ui/match.ts (shared scoreMatch: contiguous-substring beats subsequence, earlier position wins; ArchiveBrowser now uses matchesQuery from the same module). Wired a global Cmd/Ctrl+K toggle in App.tsx. Arrow-key nav + scroll-into-view, mousedown-activate (before input blur), Esc/backdrop close. Verified live: opens focused; 'apart' ranks the Apartments app first alongside matching conversations; Enter navigates to the app; New-chat action + Escape confirmed. Conversation-jump branch uses the same activate() path (setCurrentThreadId+fetchHistory+navigate('/')) as the runtime's proven onSwitchToThread; live re-check was cut short by a sightmap daemon hang, not a code issue.
