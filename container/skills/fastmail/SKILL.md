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
present. **Ignore that here.** It does not work.

### Do this instead

- **Creating / editing calendar events** → call the **direct** tools:
  `create_event` / `update_event` (they commit immediately, no widget).
- **Sending / drafting email** → use the direct send/draft tools, not any
  "compose-in-a-widget" variant.
- **If you ever call a widget-gated tool anyway** → immediately verify with
  `search_events` (or the equivalent list/search tool). If the item isn't there,
  it was NOT created — redo it with the direct tool. Never tell the user something
  was scheduled/sent until you've confirmed it exists.

## Everything else

The direct email, calendar, and contacts tools work normally — trust their own
descriptions for parameters and usage. When unsure whether an action actually
took effect, read it back with a search/list tool before reporting success.
