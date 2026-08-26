---
id: calcifer-a4b9
title: 'Command palette: Ctrl-N/P (readline) list navigation'
type: enhancement
priority: 4
created: '2026-08-26T13:51:21Z'
updated: '2026-08-26T13:51:30Z'
labels:
- web-ui
---

Add TUI/readline home-row bindings to the Cmd+K palette: Ctrl-N = next, Ctrl-P = previous, alongside the existing arrow keys. Small quality-of-life for keyboard-first users. web/src/ui/CommandPalette.tsx.

---
▸ 2026-08-26T13:51:30Z
Done. onKeyDown now treats Ctrl-N as ArrowDown and Ctrl-P as ArrowUp (preventDefault on both). Verified live: New chat → Research → Can you dig… via Ctrl-N, back up via Ctrl-P.
