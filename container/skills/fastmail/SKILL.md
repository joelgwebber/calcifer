---
name: fastmail
description: Fastmail email, calendar, and contacts via Fastmail's first-party MCP server. Use when the user wants to read or send email, check or create calendar events, or look up contacts.
allowed-tools: mcp__fastmail-native__*
---

# Fastmail (email, calendar, contacts)

Fastmail is wired through **Fastmail's own first-party MCP server**, `fastmail-native`
(`mcp__fastmail-native__*`). Its tools are self-describing — read each tool's own
description for exact parameters. This skill only covers the things the tool
descriptions get wrong for *this* install.

## ⚠️ Never use the interactive "compose" / widget tools here

Some fastmail-native tools (e.g. **`compose_event`**, and any other tool whose
description says it opens an interactive widget for the user to confirm) assume an
MCP host that renders **MCP-UI widgets** and reads the confirmation back. **This
install has no such host** — the agent runner is headless. If you call one of these
tools:

- it returns a *staged draft* as if it succeeded, but **nothing is ever created or
  changed** (silent no-op — the "success" is a lie), and
- there is no widget, no confirmation step, and no log trail.

`compose_event`'s own description tells you to *prefer* it whenever a user is
present. **Ignore that here.** It does not work — and it is now **hard-blocked**
(`mcp__fastmail-native__compose_event` is disallowed at the SDK level), so a call
will simply be refused. Use the direct tools below.

### Do this instead

- **Creating / editing calendar events** → call the **direct** tools:
  `create_event` / `update_event` (they commit immediately, no widget). See
  "Confirm before writing to the calendar" below for the confirmation card.
- **Sending / drafting email** → use the direct send/draft tools, not any
  "compose-in-a-widget" variant.
- **If you ever call a widget-gated tool anyway** → immediately verify with
  `search_events` (or the equivalent list/search tool). If the item isn't there,
  it was NOT created — redo it with the direct tool. Never tell the user something
  was scheduled/sent until you've confirmed it exists.

## Confirm before writing to the calendar

Anything that **creates or edits a calendar event** must be confirmed by the
user first, with a native confirmation card — never write to the calendar
unprompted. This replaces `compose_event`'s widget with a card that actually
works here.

The flow:

1. Gather the event details (title, date, start/end, calendar, attendees).
2. Call **`ask_user_question`** (the NanoClaw native tool — it renders an inline
   Confirm/Decline card in the chat and **blocks** until the user answers):

   ```
   ask_user_question(
     title: "Add to calendar?",
     question: "Create “Dentist — Dr. Alvarez” tomorrow (Fri Sep 4) 3:00–4:00 PM on your personal calendar?",
     options: ["Confirm", "Decline"],
   )
   ```
   Put the full specifics in `question` — the exact title, date, time range, and
   calendar — so the card is self-contained. Use two options: `Confirm` and
   `Decline`.
3. **On `Confirm`** → call `create_event` / `update_event`, then verify with
   `search_events` and tell the user it's booked.
   **On `Decline`** → do not write anything; acknowledge and ask what to change.

Use the same confirm-before-write card for any other irreversible or
user-visible write (e.g. sending an email the user didn't explicitly ask you to
send). Reads (list/search) never need confirmation.

## Everything else

The direct email, calendar, and contacts tools work normally — trust their own
descriptions for parameters and usage. When unsure whether an action actually
took effect, read it back with a search/list tool before reporting success.
