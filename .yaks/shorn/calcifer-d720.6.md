---
id: calcifer-d720.6
title: 'Gallery perf: server-side thumbnails (avoid serving full-size images in grid)'
type: idea
priority: 3
created: '2026-08-15T15:45:20Z'
updated: '2026-08-16T05:12:04Z'
labels:
- skill-views
- web-ui
- perf
---

---
▸ 2026-08-16T05:12:04Z
DONE+verified. sharp promoted to direct dep (0.34.5; already vendored via baileys + in onlyBuiltDependencies; no new download). web-thumbs.getThumbnail: sharp resize -> webp q72, EXIF .rotate(), no-enlarge, disk cache under data/thumb-cache keyed by (path,mtime,w). web: GET /api/views/:view/thumb/(.+)?w= (authed, image-only 415 otherwise, streamed webp, max-age=86400). Gallery tiles use thumbUrl(w=400); record-card thumbnails use thumb(w=200). Verified: emma-at-work.png 2,783,840B -> 11,848B webp; 2nd req instant (cache hit); .md -> 415.
