---
id: calcifer-9e4c
title: 'seafile MCP: directory move/copy (is_dir=true) still broken after calcifer-225e fix'
type: bug
priority: 1
created: '2026-08-24T18:10:00Z'
updated: '2026-08-24T19:26:04Z'
labels:
- seafile
---

Follow-up to `calcifer-225e` (fixed). That fix addressed file move/copy
(`dst_repo`/`dst_library_id`, form-encoding) and mkdir. It did NOT fix
directory move/copy — confirmed live while migrating whole `notes` folders
into `joel-wiki`.

Both of these fail identically, same error the mkdir bug used to produce:

```
seafile_move(library_id=<notes>, src_path="/ai", dst_path="/ai",
  dst_library_id=<joel-wiki>, is_dir=true)
→ Seafile API error (400): {"error_msg":"Operation not supported."}

seafile_copy(library_id=<notes>, src_path="/ai", dst_path="/ai",
  dst_library_id=<joel-wiki>, is_dir=true)
→ Seafile API error (400): {"error_msg":"Operation not supported."}
```

Tested against real content (`notes:/ai` → `joel-wiki:/ai`, both same-shape
request as the working file-mode calls, only `is_dir: true` differs). File
mode (`is_dir` omitted/false) works fine for both move and copy — this is
isolated to the dir endpoint specifically.

**Likely cause (same family as the mkdir bug):** the dir move/copy path in
`seafile-mcp-stdio.ts` probably still POSTs JSON instead of using the new
`seafilePostForm` helper, or is hitting the file endpoint's URL shape instead
of the dir endpoint's (Seafile's api2 has distinct routes/params for
`.../dir/?p=...` vs `.../file/?p=...` — worth double-checking the dir case
actually sends `dst_repo` + `dst_dir` as form fields the way the file case
does now).

**Impact:** blocks exactly the workflow this tool exists for — bulk
consolidation of whole folders between Seafile libraries. Right now every
directory has to be recreated file-by-file (`seafile_create_dir` + N ×
`seafile_copy`/`seafile_move` with `is_dir` omitted), which is impractical for
anything with a deep/wide tree (e.g. a `notes/minecraft` folder here has ~20
subfolders of world-save data — region files etc. — likely hundreds of files;
not something to walk one MCP call at a time).

**Needed fix:** find and fix the dir-mode branch of move/copy the same way
`calcifer-225e` fixed mkdir — check what body/headers it actually sends for
`is_dir: true` and align it with the working file-mode request shape.

Also worth a regression test this time (a temp dir with a couple files,
moved cross-library, then verified) before marking fixed — the previous fix
round could not be exercised live and this exact gap slipped through.

---
▸ 2026-08-24T19:26:04Z
FIXED + LIVE-TESTED (6/6 PASS against the real server, cross-library, cleaned up). Root cause: Seafile's api2 /dir/ endpoint only supports operation=mkdir|rename — NOT move/copy — so is_dir=true (which 225e routed to /api2/repos/{repo}/dir/?p=... with operation=move/copy) 400'd with 'Operation not supported'. Fix (seafile-mcp-stdio.ts): new seafileBatchItemOp() uses the v2.1 batch endpoints /api/v2.1/repos/sync-batch-move-item/ and sync-batch-copy-item/ (JSON body: src_repo_id, src_parent_dir, src_dirents:[name], dst_repo_id, dst_parent_dir) which handle files AND directories, within or across libraries. seafile_move/seafile_copy now route is_dir=true through it; the file path keeps the api2 /file/ form-encoded call (225e-verified). Both also ensureDir(dstRepo, dstDir) first. Regression test (throwaway, reads creds from container_configs, never prints token): temp dir+file, cross-library COPY (dir appears in dst, file survived, source retained) + MOVE (appears in dst, file survived, gone from source) — all PASS; verified via import.meta.main guard + exported helpers. DEPLOY: agent-runner src is mounted RO into containers — live on next spawn; recycle Calcifer's running container (ncl groups restart) to pick it up.
