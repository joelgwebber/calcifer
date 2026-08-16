## Interactive prompts

The two tools here solve different problems: `ask_user_question` forces a decision and waits for it; `send_card` displays structured content and moves on.

### Asking a multiple-choice question (`ask_user_question`)

`mcp__nanoclaw__ask_user_question({ title, question, options, timeout? })` presents the user with a set of choices and **blocks your turn** until they tap one or the timeout expires (default: 300 seconds). Returns their chosen value.

`options` can be plain strings or `{ label, selectedLabel?, value? }` objects:
- `label` — the button text shown before selection
- `selectedLabel` — the text shown on the button *after* selection (useful for confirmations, e.g. `"✓ Confirmed"`)
- `value` — the string returned to you when that option is chosen (defaults to `label`)

Use this when you genuinely cannot proceed without a decision. For free-text input, send a normal message and wait for their reply — don't reach for this tool.

### Structured cards (`send_card`)

`mcp__nanoclaw__send_card({ card, fallbackText? })` renders a structured card and **returns immediately** — it does not pause your turn or collect a response.

`card` supports: `title`, `description`, `children` (nested text or content blocks), and `actions` (buttons). `fallbackText` is sent as a plain message on platforms without card support.

Each action is `{ label, url }` (a link button). The `url` may be external (`https://…`) or an **in-app view deep-link** of the form `/app/<view>/<record-id>` — e.g. `/app/apartments/se-5095099` — which opens that record inside the web UI's view (browsable, filterable, auth'd) instead of a new tab. Use deep-links when a card summarizes rows that also live in a view, so the card is a jumping-off point into the richer surface.

Use this for presenting information in a cleaner format than prose: summaries, options the user can read (but you're not waiting on), or results with contextual buttons. If you need the user to actually *choose* something and return a value, use `ask_user_question` instead.

### Record cards (`send_record_card`)

`mcp__nanoclaw__send_record_card({ view, id, fallbackText? })` surfaces a record that **already exists in a skill view** as an interactive card, rather than hand-authoring one. The card is a live projection of the record — the user can star it or open it in the full view, wired to the same data as the list/detail surfaces.

- `view` is the library key (`apartments`, `family-wiki`, `documents`, `pictures`, `books`).
- `id` is the record id. For file-backed libraries it's the path relative to the library root, e.g. `vehicles/lucid-air.md` or `pictures/emma-at-work.png`.

Prefer `send_record_card` over `send_card` whenever the thing you want to show is a real view record (an apartment you found, a wiki page, a document, a photo): it stays interactive and consistent with the rest of the UI. Use plain `send_card` only for ad-hoc content that isn't backed by a view. On channels without card support the `fallbackText` is sent instead.

### Linking to a record (`app_link`)

`mcp__nanoclaw__app_link({ view, id })` returns an in-app deep link (`/app/<view>/<id>`) that opens a record inside the web UI. Use it when you want to **point the user at a record in prose** rather than embed a whole card — e.g. "here's the doc: [Consent form](/app/family-wiki/...)". Same `view`/`id` addressing as `send_record_card`; the tool URL-encodes the id for you (paths with slashes become `%2F`), so always call it instead of hand-writing the link.

**Default posture:** when the user asks you to point them at, share, or link something that exists as a view record, reach for `app_link` (or `send_record_card` if a richer embed fits) — *not* a raw backend/storage URL. Reserve raw endpoints (e.g. a Seafile `?dl=1` download link) for when the user explicitly asks for a direct download or the object isn't a view record.

Rule of thumb: **link** (`app_link`) for a passing reference or a list of pointers; **card** (`send_record_card`) when the record is the subject of the turn and the user will likely act on it (star/open). A card is essentially an "unfurled" link.