---
id: calcifer-a9d9
title: 'fastmail-native compose_event silently no-ops: no MCP-UI widget host wired in NanoClaw'
type: bug
priority: 1
created: '2026-09-03T13:30:00Z'
updated: '2026-09-03T15:15:58Z'
labels:
- fastmail
- mcp
- web-ui
---

## Symptom

Called `mcp__fastmail-native__compose_event` (staging a calendar event for
Joel: "Therapy – Juliet Buchwalter", 2026-09-03T14:15, personal calendar,
inviting joel@fullstory.com) from the `joel-web` channel. The call returned
success — the staged event JSON — as if the event existed. No interactive
widget appeared in the web UI. A follow-up `search_events` query for the
same title/date range came back empty: the event was **never actually
created**. Had to fall back to `create_event` directly to get a real event
on the calendar.

## Root cause

`fastmail-native` is Fastmail's own first-party remote MCP server
(`type:"http"`, `url: https://api.fastmail.com/mcp`), wired straight through
to the Claude Agent SDK per `groups/dm-with-joel/container.json` (~lines
70-76). NanoClaw does not implement or proxy it.

Its `compose_event` tool description explicitly tells the caller to *prefer*
it over `create_event`/`update_event` whenever a user is present, and says
the event only commits when the user confirms in an interactive widget —
readable back via a "read-widget-context" host tool, or by falling back to
`search_events`. That assumes an MCP host with generic UI-widget/MCP-UI
support.

**No such mechanism exists anywhere in this NanoClaw install.** Grepped both
`/workspace/agent` and the full `/workspace/extra/calcifer-project` tree
(`src/`, `container/agent-runner/src/`, docs) for `read_widget_context`,
`readWidgetContext`, `widget_context`, `widgetContext`, and `widget`
generally — zero matches outside unrelated noise. No tool, MCP resource, or
host callback named anything like "read-widget-context" exists.

NanoClaw's actual interactive-UI mechanism is unrelated: `send_card` /
`send_record_card` / `ask_user_question` in
`container/agent-runner/src/mcp-tools/interactive.ts`, which write rows to
`messages_out` (`kind:'chat-sdk'`) rendered by the web adapter
(`src/channels/web-cards.ts`, `web.ts`, `web-views.ts`) via the Chat SDK
bridge. `joel-web` does support widgets — but only this NanoClaw-native card
format. There's no generic passthrough for arbitrary third-party MCP UI
content, so it silently can't render whatever `compose_event` was expecting.

No log trail either: `compose_event` calls aren't logged by the host at all
for pass-through HTTP MCP servers (unlike native `mcp-tools`, which log with
a `[mcp-tools]` prefix). `grep -n "compose_event\|fastmail-native\|widget"
logs/calcifer.log logs/calcifer.error.log` → zero hits. The call just
silently returns its staged JSON as a normal tool result with nothing to
render it and nothing that ever commits it.

## Impact

Any agent using `fastmail-native`'s `compose_event` — the tool the server's
own instructions say to prefer whenever a user is present — will believe an
event was created/edited when nothing happened, with no error, and no way to
detect the gap except manually re-querying `search_events` afterward. Same
risk applies to any other action in the fastmail-native server gated behind
the same widget-confirm pattern, if one exists.

## Fix options to evaluate

1. Teach the fastmail-native skill/agent instructions to never use
   `compose_event` in this install and always use `create_event` /
   `update_event` directly, since there's no host support for the widget
   flow.
2. Implement a `read-widget-context` shim mapped onto the existing
   `send_card` mechanism, if that's feasible for this MCP-UI convention.
3. At minimum: have the agent always verify via `search_events` after any
   `compose_event` call, so silent failures don't reach the user as false
   confirmations. (This is what caught the bug this time.)

## Refs

- `groups/dm-with-joel/container.json:70-76`
- `container/agent-runner/src/mcp-tools/interactive.ts`
- `src/channels/web-cards.ts`

## Related, smaller finding

`container/tools/yaks/yak.py` — the path CLAUDE.local.md documents for
filing yaks — was deleted in commit `e3c7d72f` ("Deleting old yak tools",
2026-08-23) and never replaced; CLAUDE.local.md (both
`/workspace/agent/CLAUDE.local.md` and
`groups/dm-with-joel/CLAUDE.local.md`) still points at it. No `yak`/`yak.py`
binary exists anywhere in this container or the host repo checkout. Filed
this yak by hand-writing the markdown file directly instead, matching the
pattern already used in `calcifer-c4b7`. Worth fixing the docs or restoring
the CLI — repeat sessions keep hitting the same dead end.

---
▸ 2026-09-03T14:34:36Z
VERIFIED all claims (live config + codebase):
- fastmail-native = remote HTTP MCP (type:http, https://api.fastmail.com/mcp) passed straight to the Agent SDK in Joel's container_configs. Confirmed.
- Zero MCP-UI/widget host support in src/ or container/agent-runner/src/ (grep read_widget/widget_context/mcp-ui/ui_resource/EmbeddedResource = empty). NanoClaw's only interactive surface is its own send_card/send_record_card/ask_user_question (chat-sdk rows). Confirmed.
- yak.py: deleted in e3c7d72f; groups/dm-with-joel/CLAUDE.local.md:16 STILL points at 'python3 container/tools/yaks/yak.py'. Dead path. Confirmed.

KEY NEW FINDING: the NATIVE 'fastmail' MCP (container/agent-runner/src/fastmail-mcp-stdio.ts) already provides fastmail_create_event / fastmail_list_calendars / list-events over CalDAV — all headless, no widget. And Joel's group wires BOTH 'fastmail' and 'fastmail-native', so the agent had a redundant widget-gated path and took it (compose_event's own description says 'prefer me').

DIAGNOSIS: 'UI cards' here = MCP-UI widgets the remote server returns, NOT NanoClaw's own cards (which work). NanoClaw's runner is headless — no MCP-UI layer — so compose_event's staged-draft+widget-confirm can't render or commit; the tool returns the staged JSON as 'success' => silent false success.

RECOMMEND (cheap+robust, not generic MCP-UI support):
1. Guidance in container/skills/fastmail/SKILL.md: headless install, no widget host — never use fastmail-native compose_event/widget-gated tools; use direct create/update (fastmail_create_event or fastmail-native create_event/update_event); if a widget tool is used, verify with search_events (silent no-op otherwise).
2. Config (owner call): consider dropping fastmail-native for Joel (native fastmail covers calendar/email/contacts) or keep only for features native lacks.
3. Fix the yak.py dead reference in CLAUDE.local.md (agent had to hand-write this yak).
Generic MCP-UI passthrough (option 2 in the report) is a real feature for the cards/skill-views/artifacts roadmap but massive overkill for this bug.

---
▸ 2026-09-03T15:15:58Z
SHORN — consolidated on Fastmail's first-party MCP, nuked the homegrown one. Changes:
- DB: removed the homegrown 'fastmail' MCP server from dm-with-joel (ncl groups config remove-mcp-server). Only group that had it; family groups had neither. fastmail-native retained.
- Source: DELETED container/agent-runner/src/fastmail-mcp-stdio.ts (no importers — live index.ts is config-driven, not hardcoded; container typecheck clean).
- Skill: rewrote container/skills/fastmail/SKILL.md → allowed-tools mcp__fastmail-native__*; documents the CRITICAL caveat (never use compose_event / widget-confirm tools — headless, silent no-op; use direct create_event/update_event; verify with search_events).
- Docs: updated CALCIFER.md 'Fastmail (current state)' — consolidated on fastmail-native, retirement noted, headless caveat documented.
- CLAUDE.local.md (dm-with-joel): fixed the dead 'python3 container/tools/yaks/yak.py' reference (deleted in e3c7d72f) → hand-write the markdown file directly (the method that actually works in-container; no yak CLI is mounted).
Left as-is: shorn reliability yaks 569e(+children)/3175/3250 (history of the retired server); conversation transcripts (archived history, not live refs); derived container.json (regenerates on next spawn). Agent-runner source is bind-mounted so no image rebuild — recycle Joel's container to pick up the new config + skill + regenerated container.json.
NOTE: yaks CLI absence in-container is a broader papercut worth its own fix (mount yaks or a shim); documented the working fallback for now.
