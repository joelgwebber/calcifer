---
id: calcifer-1adb
title: Better chat width-scaling
type: bug
priority: 1
created: '2026-08-24T13:05:12Z'
updated: '2026-08-24T13:10:54Z'
parent: calcifer-2520
labels:
- web-ui
---

At smaller screen-widths, the chat messages leave too much white space to the left/right, squeezing the text badly. See attachment.

---
▸ 2026-08-24T13:10:54Z
FIXED + verified live via sightmap at 390px (squeezed before) and 1280px (unchanged/good). Root cause: .message-bubble had a flat max-width:70% plus a fixed 24px thread-viewport padding — on narrow screens 70% of an already-small width squeezed text into ~5 words/line with big empty gutters. Fix (web/src/styles.css): max-width: min(90%, 65ch) — 90% wins on narrow screens (fills the width), 65ch caps line length on wide ones for readability; plus @media(max-width:700px) trims thread-viewport padding to 14px/12px. Attachments (repro of the reported view; I couldn't extract the original image bytes, so these are sightmap captures): .yaks/artifacts/calcifer-1adb/repro-before.png and repro-after.png.
