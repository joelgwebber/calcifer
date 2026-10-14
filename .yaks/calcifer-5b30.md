---
id: calcifer-5b30
title: 'wiki: durable fastmail:// email reference scheme — real resolution support'
status: hairy
type: feature
priority: 1
created: '2026-09-05T17:15:00Z'
updated: '2026-09-05T17:15:00Z'
labels:
- wiki
- fastmail
- family-wiki
---

Joel asked (2026-09-05, joel-web) for a durable way to reference a specific Fastmail
email from wiki markdown, e.g. `[seen in this email](fastmail://<id>)`. Landed as a
convention only — agents write and read these links by hand-calling `read_email`.
There's no actual wiki-level support for resolving/rendering them yet.

**Interim convention in use** (see `family/Emma/leman/` in the family wiki for
examples): link target is the JMAP `id` from `search_email`/`read_email`
(`fastmail://<jmap-id>`), which is stable across folder moves within the account.
The link title attribute carries a human fallback: subject, date, and the RFC 5322
`Message-ID` header, e.g.:

```markdown
[Boarding Summer Mailing](fastmail://StnBwdJqKndF "Boarding Summer Mailing — Aug 18 2026; Message-ID: <CAERAkUR+WVYVoVHffr+mnvf8ERdBiXLoH0z=tFmUD5MCj7mSTA@mail.gmail.com>")
```

JMAP `id` is what's actionable today (`read_email({id})` resolves it directly) but is
account-scoped and could theoretically be invalidated (account migration, mailbox
rebuild). The `Message-ID` header is the true globally-unique/durable identifier but
isn't directly fetchable through the current `search_email` qualifiers — would need
either a dedicated qualifier or a `text:` fallback search.

**To implement:**
1. Decide where resolution logic lives — likely a small helper any agent/skill can
   call: `resolveFastmailLink(uri) -> emailId`, try `read_email(jmap-id)` first, and
   on failure parse the title's `Message-ID:` and fall back to a search.
2. Wiki-view / rendering support (if/when the wiki gets a skill-view or web
   projection) to make `fastmail://` links clickable/previewable rather than inert
   markdown, similar to how `send_record_card` projects other view types.
3. Update the `family-wiki` skill's instructions to document the convention so all
   family agents write links the same way.

Low urgency to implement immediately, but flagged priority 1 since the convention is
already being used in real wiki content and any resolver work should standardize on
it rather than drift.
