---
id: calcifer-1d51
title: Declarative skill views — addressable, auth'd UI surfaces for skills
type: feature
priority: 2
created: '2026-07-06T18:18:17Z'
updated: '2026-07-06T18:26:27Z'
depends_on:
- calcifer-7c3a.1
- calcifer-7c3a.6
labels:
- web-ui
- skill-views
---

Umbrella yak. A general mechanism for skills to expose richer UI than inline chat cards, without each skill reinventing serving/auth/protocol.

## Problem
Skills accumulate structured state (e.g. nyc-apt's listings.db). Inline cards (7c3a.4) are good for point-in-time results but are not addressable (buried in chat scroll) and make CRUD-y/high-frequency interactions (star, filter, paginate) cost an LLM turn. We want persistent, interactive, auth'd surfaces that skills declare cheaply.

## Core design decisions (settled with owner)
1. THE AXIS is where data flows: through the agent (a conversational LLM turn) vs a direct data plane (host reads/serves without waking a container). Facts that are CRUD-y/high-frequency use the direct plane; judgment stays with the agent.
2. FACTS vs ANNOTATIONS split. Agent owns the fact store (e.g. listings.db) — host reads it READ-ONLY (same precedent as session-DB history in 7c3a.2; needs journal_mode=DELETE for cross-mount freshness). Stars/notes/read-state are host-owned annotations. Single-writer discipline: host never writes the skill's DB.
3. SHARED, not per-user (owner: Calcifer is family-shared). Annotations table drops the user axis entirely: annotations(skill, entity_id, key, value). Simpler schema/queries/no auth-scoping on annotations.
4. DECLARATIVE-FIRST. No skill-shipped/sandboxed client code in v0. Core ships a FIXED data protocol + FIXED primitive vocabulary; a skill's static manifest composes primitives with field bindings. Host renders from its own trusted components -> safe, consistent, cannot break shell.
5. Primitive vocabulary (starter): atoms text/money/datetime/number/bool/badge/image/link/keyvalue; composites list/card/detail/gallery/timeline; filters range/multiselect/toggle/daterange/search; actions star/note/open/ask. Typed fields -> sensible rendering.
6. ASK action is the escape valve: sends a templated message to the agent, bridging the direct plane back to conversational smarts.
7. ADDRESSABLE + AUTH'D + INTERACTIVE links are first-class. Views are SPA routes with URL-encoded state and per-record URLs (/app/apartments/listing-123), fully live, riding the existing session cookie (login-then-return for deep links). Cards become projections of the same records; a card's Open link points at the record's view, not a chat message. Works for any family member (shared auth+data).
8. CUSTOM-BACKEND SEAM (not v0, but designed for): declarative is the 80% path, not a cage. Custom query/action logic plugs in BEHIND the host's authenticated /api/views/<view>/... namespace, never as a parallel public port. Tiers: (1) declarative over workspace sqlite; (2) custom backend via data.type:http proxy or a registerViewProvider-style host module (host injects authed context); (3) sandboxed iframe+bridge for custom render. data.type is a pluggable enum: sqlite | http | agent.

## Other consumers to keep in mind (not v0, inform the abstractions)
- Wiki ('find pages about X', read docs, follow links): needs a document/prose primitive + intra-view navigate action (internal link -> record). Watch: HTML sanitization.
- Seafile file browser: hierarchical tree/browser primitive + byte/download endpoint (shares plumbing with attachments 7c3a.3); data.type:http (remote service, not a workspace sqlite).
These tell us to leave data.type and the primitive/action sets as OPEN enums so wiki/seafile slot in without a redesign.

## v0 scope
Working, addressable, auth'd apartments browser (list/detail/filter/star/open) built on the general-but-minimal mechanism. See children. Depends on the web UI + auth foundation (7c3a.1, 7c3a.6).

## Relationship to 7c3a
Sibling to the web-UI herd (7c3a). 7c3a.4 (inline cards) remains the near-term conversational surface; this herd is the persistent/addressable surface. Cards link into views.
