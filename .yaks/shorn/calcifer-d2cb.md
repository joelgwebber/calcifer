---
id: calcifer-d2cb
title: family-wiki view hides non-markdown files from directory listing (exts filter too strict)
type: bug
priority: 1
created: '2026-08-24T17:35:00Z'
updated: '2026-08-24T17:33:55Z'
labels:
- views
---

Reported by Joel while reorganizing Seafile libraries into `family-wiki`: PDFs,
images, and other non-markdown files placed inside the wiki libraries don't
show up in the directory listing at all — even though the intent is that
they'd open in a new window/tab (they can't render inline as markdown). Books,
Documents, and Pictures libraries browse fine; this is specific to the
markdown/wiki structure.

**Root cause:** `container/skills/family-wiki/view.json` declares
`"data": { "type": "fs", "root": "family-wiki", "exts": ["md"] }`. In
`src/views/data-plane.ts`, both `browseFs()` (~line 421) and `walkFiles()`
(~line 450) skip any file whose extension isn't in `exts` when it's set:

```
if (exts && !exts.has(path.extname(d.name).replace(/^\./, '').toLowerCase())) continue;
```

So with `exts: ["md"]`, a PDF sitting right next to a markdown page is
invisible in the tree/listing — there's no entry to click to open it.

By contrast, `container/skills/seafile/views/{books,documents,pictures}.json`
have no `exts` key at all (`exts` resolves to `null`), so every file type
shows for those libraries — matching Joel's observation that those three work
fine.

Notably the single-file byte-serving path (used to actually open a file, e.g.
in a new tab) is **already** exts-agnostic by design — the comment above the
resolver says: "a markdown page may reference a sibling .pdf/.png that isn't
itself a record." So opening a non-md file already works once you have a
link/path to it; the bug is purely that the listing/tree never surfaces one as
a clickable entry in the first place.

This isn't a Seafile server-side limitation — it's entirely in this repo
(`src/views/data-plane.ts` + the `family-wiki` view manifest), confirmed by
reading the fs data-source code and comparing it against the three
non-filtered library manifests.

**Needed fix:**
- Either drop `exts: ["md"]` from `family-wiki/view.json` so `browseFs` /
  `walkFiles` stop filtering entirely, or
- Change the fs data-source semantics so `exts` only governs which files
  become full "document" records (with rendered markdown content, search
  indexing, etc.) while non-matching files still appear in `browseFs` tree
  listings as plain openable/linkable entries (similar to how `kind`/`ext`
  badges already work in the Books/Documents views).

The second option preserves the current search/record behavior for markdown
content while fixing the visibility gap; worth considering since `family-wiki`
is about to receive a large volume of non-markdown documents (PDFs, scans,
photos) as part of an in-progress Seafile library consolidation, so this will
block/confuse that reorg's usability once files land there.

This is now blocking on the actual document consolidation Joel asked for
(merging Seafile libraries `documents`/`notes`/`threads` into `family-wiki`) —
those files need to be visible and clickable once moved, not just present on
disk.

---
▸ 2026-08-24T17:33:55Z
FIXED + verified live via sightmap. Chose Calcifer's option 2: exts governs which files become full document records (walkFiles: rendered content + search), NOT the browse tree. Dropped the exts filter from browseFs() in src/views/data-plane.ts (and its now-unused param) so every file lists in a tree presentation; non-md siblings open via the already-exts-agnostic byte endpoint (frontend FileName routes non-text exts to fileUrl/new tab). walkFiles still honors exts, so markdown record/search behavior is unchanged. family-wiki/view.json left as-is (keeps its md 'content' document semantics). Verified: browsing family-wiki/calliope/property now shows all 13 PDFs/PNG (previously hidden). Host code -> rebuilt dist + restarted service to deploy.
