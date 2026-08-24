---
id: calcifer-225e
title: 'seafile MCP: binary files corrupted on read/upload, move can''t cross libraries, and folder creation is broken entirely'
type: bug
priority: 1
created: '2026-08-24T17:04:27Z'
updated: '2026-08-24T17:14:26Z'
labels:
- seafile
---

Source: `container/agent-runner/src/seafile-mcp-stdio.ts` (compiled to
`dist/seafile-mcp-stdio.js`). Found while trying to reorganize/merge several
Seafile libraries for Joel — any plan that needs to relocate PDFs, DOCX,
photos, or audio across libraries is currently blocked.

**1. `seafile_read_file` corrupts binary content.**
Both code paths coerce bytes to a JS string via UTF-8 decoding, which is
lossy/irreversible for non-text files:
- API path: `const content = await response.text();` (line ~215) — the raw
  fetch response body is decoded as UTF-8 no matter the file type.
- Local-sync path: `tryReadLocal` calls `fs.readFile(localPath, 'utf-8')`
  (line ~82) — same problem.

Confirmed by reading a `.docx` — the tool returned garbled text full of
U+FFFD replacement characters. There's no `encoding`/`binary` param and no
base64 fallback, so once a binary file goes through this tool the original
bytes are unrecoverable from the response.

**2. `seafile_upload_file` can't accept binary content.**
`content: z.string()` is the only input, and the code does
`new Blob([args.content], { type: 'text/plain' })` (line ~260) — always
UTF-8 text, always the plain-text mimetype. There's no way to pass binary
(e.g. base64) content through to be uploaded byte-for-byte, so even a file
you *haven't* round-tripped through `seafile_read_file` can't be uploaded if
it's not text.

**3. `seafile_move` cannot move across libraries even though the Seafile API supports it.**
The tool builds the move request with `dst_repo: args.library_id` (line
~358) — it always hardcodes the destination repo to be the *same* as the
source, regardless of what path the caller passes in `dst_path`. Seafile's
`/api2/repos/{repo_id}/file/` move operation genuinely supports a distinct
`dst_repo`, but the tool schema doesn't even expose a `dst_library_id`
parameter to set it. A cross-library move attempt fails with
`Seafile API error (400): {"error_msg":"Operation can only be rename, create or move."}`
— not because Seafile can't do it, but because this wrapper never sends the
right `dst_repo`.

**4. `seafile_create_dir` (and upload's internal auto-mkdir) can't create new folders at all.**
Discovered while actually trying to use this: `seafile_create_dir` on a
brand-new path (both top-level and nested under an existing folder) always
fails with `Seafile API error (400): {"error_msg":"Operation not supported."}`.
Looking at `seafileRequest` (line ~33-53), it always sends
`'Content-Type': 'application/json'` and the mkdir call
(`seafile_create_dir`, line ~301-308, and the identical inline call inside
`seafile_upload_file`'s "ensure parent directory exists" step, line ~239-249)
POSTs a JSON body (`JSON.stringify({ operation: 'mkdir' })`). Seafile's
`api2` dir endpoint expects `operation=mkdir` as a
`application/x-www-form-urlencoded` body, not JSON — this is almost
certainly why every mkdir call 400s. Because `seafile_upload_file` swallows
mkdir errors (`try { ... } catch { /* ignore */ }`), this failure is
invisible until the subsequent upload also fails with
`Seafile API error (404): {"error_msg":"Folder /x not found."}` for any path
whose parent doesn't already exist — so today, **no new folder can be
created anywhere, at any depth, via these tools.** This blocks essentially
any reorg/taxonomy work, not just binary files — confirmed live while trying
to create a new top-level `/calliope` folder in family-wiki, which failed
outright.

**Needed fixes:**
- `seafile_read_file`: detect/accept a binary mode (or always base64-encode
  and let the caller decide) instead of unconditionally decoding as UTF-8
  text. Applies to both the local-sync and API code paths.
- `seafile_upload_file`: accept binary content (e.g. `content_base64` +
  `encoding` param, or auto-detect), and build the Blob with the correct
  bytes + mimetype instead of always `text/plain`.
- `seafile_move`: add a `dst_library_id` param (default to `library_id` for
  back-compat) and pass it through as `dst_repo` — this alone should unlock
  real cross-library moves since the underlying Seafile API already supports
  it.
- Consider a `seafile_copy` tool (Seafile supports `operation: 'copy'`) so a
  cross-library relocation can be verified before the source is deleted.
- `seafile_create_dir` and the inline mkdir in `seafile_upload_file`: send
  `operation=mkdir` as form-urlencoded (or switch both to the `/api/v2.1/`
  endpoint if that accepts JSON) instead of JSON via the shared
  `seafileRequest` helper, which hardcodes `Content-Type: application/json`
  for every call. Also stop swallowing the mkdir error silently in
  `seafile_upload_file` — surface it so a failed auto-mkdir doesn't show up
  three steps later as a confusing "folder not found" on upload.

This blocks any Seafile library reorg/consolidation involving non-text
files or new folders, and will recur — Joel expects to need this regularly.

---
▸ 2026-08-24T17:14:26Z
FIXED (container/agent-runner/src/seafile-mcp-stdio.ts, type-clean via container tsconfig). All 4 diagnosed bugs + the suggested copy tool:
1. seafile_read_file: new encoding param (utf-8|base64). base64 preserves exact bytes for binary (API path uses response.arrayBuffer()->base64; local path reads Buffer->base64). tryReadLocal now encoding-aware.
2. seafile_upload_file: new encoding param; base64 -> Buffer -> Blob with a best-effort mimetype (guessMime by extension) instead of always text/plain.
3. seafile_move: added dst_library_id (defaults to library_id) passed as dst_repo -> real cross-library moves; added is_dir (uses dir vs file endpoint); switched to form-encoded. NOTE: move goes INTO dst_dir keeping the source filename (it's a move, not a rename) — description updated to say so.
4. mkdir: root cause was JSON body via seafileRequest (hardcodes Content-Type: application/json); Seafile api2 wants x-www-form-urlencoded. New seafilePostForm helper + recursive/idempotent ensureDir (creates missing intermediates, surfaces real failures). seafile_create_dir and upload's auto-mkdir both use it; upload no longer swallows mkdir errors.
5. New seafile_copy tool (operation=copy, cross-library, is_dir) so a relocation can be verified before deleting the source.

DEPLOY: agent-runner src is mounted RO into containers (never baked) — fix is live on the next container spawn. If Calcifer's reorg container is running, recycle it (ncl groups restart) to pick up the new mount; no ./container/build.sh needed. Could not exercise live (no Seafile creds here); fixes follow Calcifer's live-tested diagnosis.
