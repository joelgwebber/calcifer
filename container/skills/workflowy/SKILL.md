---
name: workflowy
description: WorkFlowy outliner for todos, notes, and ephemeral reminders. Use when the user wants to add/check todos, make a quick note, or read/update the shared Notes node.
allowed-tools: mcp__workflowy__*
env-guard: WORKFLOWY_API_KEY
---

# WorkFlowy

Hierarchical outliner for tasks, notes, and ephemeral context.

## Shared Notes Node

The **Notes** node (ID: `e6a0f82e-7fb2-57da-deec-9907d8fb4dfc`) holds ephemeral shared context: parking spot, rental car plate, temporary reminders, etc.

**At the start of each conversation**, read it:
```
mcp__workflowy__workflowy_list_children(parent_id="e6a0f82e-7fb2-57da-deec-9907d8fb4dfc")
```

When the user says "make a note" or "remember" something ephemeral, add it here. Keep notes concise. Remove outdated ones — these are not permanent facts (use CLAUDE.md or memory for those).

## TODO List

Joel's main TODO list node ID: `afa78f75-e263-8b83-fc46-7372206a926e`

## Tools

**mcp__workflowy__workflowy_list_targets** — List shortcuts and built-in locations (inbox, home)

**mcp__workflowy__workflowy_list_children** — List child nodes
- `parent_id` (target key, UUID, or "None" for top-level)

**mcp__workflowy__workflowy_get_node** — Get node details
- `id` (UUID)

**mcp__workflowy__workflowy_create_node** — Create a node
- `parent_id`, `name`, `note` (optional), `layoutMode` (bullets/todo/h1/h2/h3/code-block/quote-block), `position` (top/bottom)

**mcp__workflowy__workflowy_update_node** — Update a node
- `id`, `name` (optional), `note` (optional), `layoutMode` (optional)

**mcp__workflowy__workflowy_move_node** — Move a node
- `id`, `parent_id`, `position` (optional)

**mcp__workflowy__workflowy_delete_node** — Delete a node permanently
- `id`

**mcp__workflowy__workflowy_complete_node** — Mark todo as done
- `id`

**mcp__workflowy__workflowy_uncomplete_node** — Unmark todo
- `id`

**mcp__workflowy__workflowy_export_all** — Export all nodes (rate-limited: 1/min)

## Example

```
# Read Notes
mcp__workflowy__workflowy_list_children(parent_id="e6a0f82e-7fb2-57da-deec-9907d8fb4dfc")

# Add a note
mcp__workflowy__workflowy_create_node(parent_id="e6a0f82e-7fb2-57da-deec-9907d8fb4dfc", name="Parking: Level 3, Space A42")

# Add a todo
mcp__workflowy__workflowy_create_node(parent_id="inbox", name="Call dentist", layoutMode="todo")

# Complete a todo
mcp__workflowy__workflowy_complete_node(id="<uuid>")
```
