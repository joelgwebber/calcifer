---
id: calcifer-969f
title: Fix web-user.ts for the async DB layer
type: bug
priority: 2
created: '2026-08-30T00:58:04Z'
updated: '2026-08-30T00:59:33Z'
parent: calcifer-2137
labels:
- ops
---

scripts/web-user.ts calls the DB helpers synchronously, but the DB layer went async (getAllUsers/getUser/upsertUser/upsertCredential/getCredential + runMigrations now return Promises). 'list' throws 'getAllUsers(...).filter is not a function', and 'add' would process.exit(0) before the async credential write lands. Fix: await every DB call + runMigrations; make cmdList/cmdRemove async.

---
▸ 2026-08-30T00:59:33Z
Fixed: awaited every DB helper (all async post-refactor) + runMigrations + initDb; made cmdList/cmdRemove async. Verified: 'list' now returns web:local/joel/alicia cleanly. tsc clean.
