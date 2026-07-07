---
id: calcifer-01fa
title: 'Cross-group agent messaging: family members can reach each other''s agents'
type: idea
priority: 3
created: '2026-04-19T22:34:10Z'
updated: '2026-06-25T01:33:03Z'
commit: 69040c9
---

Route a question or request to another family member's agent: 'Ask Alicia's agent what her schedule looks like next weekend.' Routed through main group. Privacy-preserving: the receiving agent decides what to share based on its own context.

---
▸ 2026-04-22T03:25:01Z
Refined design: send-only model, not cross-agent query.

## Approach
Joel's agent sends a message to another family member via their normal channel. No cross-agent coupling — the recipient sees it as a regular message and their agent responds normally.

## Implementation plan

### 1. Contact map config
Small name→JID mapping in .env or a JSON config file:
  AGENT_CONTACTS='{"alicia": "telegram:+1234567890"}'
Resolved by the host process, never exposed to containers directly.

### 2. MCP tool: send_message
Exposed inside containers via a new MCP server (or added to an existing one):
  send_message(to: string, message: string)
Tool calls back to the host process via the credential proxy (port 3001) or a dedicated IPC endpoint.

### 3. Host-side handler
New route on the credential proxy (or IPC watcher) that:
  - Resolves 'alicia' → channel JID using the contact map
  - Calls channel.sendMessage(jid, text) on the appropriate channel
  - Returns success/failure to the container

### 4. Message framing
Outbound message prefixed to make agent origin clear, e.g.:
  'Calcifer (on Joel's behalf): Joel wanted me to ask — what does your schedule look like next weekend?'

### 5. Wire up in agent runner
Add the tool to allowed-tools in index.ts and register the MCP server.

## Out of scope
- Response routing back to Joel's agent (Alicia replies normally in her own chat)
- Cross-user data sharing / calendar access (separate yak)
- Privacy controls beyond Alicia seeing and deciding herself

---
▸ 2026-06-24T20:07:53Z
Reopened for v2. Original Apr-2026 conclusion (send-only, no cross-agent coupling) was a v1-era call made before the v2 agent-to-agent module existed; da67 explicitly said to wait for the v2 primitive. v2 now ships src/modules/agent-to-agent/ — a real bidirectional channel: source_session_id reply routing (in_reply_to -> peer-affinity -> newest session), file forwarding, addressed via the same <message to="name"> syntax / send_to_agent tool with a target_type='agent' destination. Upstream norms: same mechanism as channel sends; receiver sees a normal chat message carrying sender/senderId (agent:<group>); BIDIRECTIONAL permission rows required (a destination on each side); relay with provenance ('Joel asked me to pass along...'). Note: upstream documents a2a mainly as supervisor/worker orchestration; multi-USER coordination is steered toward the isolation model (shared agent/session) = the separate, still-open 5ecc track. Plan (option C, this install): (1) remove channel dest 'alicia' on dm-with-joel ag-1777141351652-tx7j2h; (2) add agent dest 'alicia' -> ag-1777142047617-ue4hdh on dm-with-joel; (3) add reverse agent dest 'joel' -> tx7j2h on dm-with-alicia; (4) keep Alicia's WhatsApp DM (mg a6ea4196) wired inbound to dm-with-alicia so her Calcifer reaches her phone; (5) persona notes in both groups' CLAUDE.md describing the peer + provenance framing. Does NOT preclude 5ecc group messaging; a family-group agent can later be a a2a peer too (fan-out or broadcast-to-group-chat).

---
▸ 2026-06-24T20:13:03Z
IMPLEMENTED (option C wiring). dm-with-joel (tx7j2h): channel dest 'alicia' removed; agent dest 'alicia' -> ue4hdh added. dm-with-alicia (ue4hdh): agent dest 'joel' -> tx7j2h added; channel dest 'alicia' -> WhatsApp mg a6ea4196 added (REQUIRED for the relay to reach Alicia's phone -- the earlier 'ncl wirings create' used generic CRUD insert which bypassed createMessagingGroupAgent()'s auto-destination). Her WhatsApp wiring session_mode changed shared -> agent-shared: the a2a path hardcodes agent-shared resolution (resolveTargetSession -> resolveSession(.., 'agent-shared') -> findSessionByAgentGroup), so leaving WhatsApp as 'shared' would fragment ping vs reply into separate sessions depending on arrival order. agent-shared on both converges to one session. Persona/relay notes added: groups/dm-with-joel/CLAUDE.local.md (Alicia's Calcifer = peer agent, provenance framing) and groups/dm-with-alicia/CLAUDE.local.md (enhanced existing baseline; joel=peer agent, alicia=her WhatsApp). CORRECTION: dm-with-alicia is NOT an empty shell -- it has container.json (seafile/readeck/simple-memory MCP, family-wiki mount from 5ecc.1, skills:all) and has run before; earlier 'empty' read was a stale directory listing. OPEN ITEMS: (1) ue4hdh has a stray channel dest 'telegram-mg-17771' -> Joel's Telegram (mg-1777141312465) created at group-creation Apr-25 -- looks like a misconfiguration, Alicia's agent should not be able to message Joel's Telegram; flagged for Joel to confirm removal. (2) Alicia's personal wiki (alicia-wiki / SEAFILE_WIKI_LIBRARY) never populated per 5ecc.1 -- not blocking. (3) End-to-end test pending (Joel: 'tell alicia ...').

---
▸ 2026-06-24T20:20:45Z
Removed stray channel dest 'telegram-mg-17771' -> Joel's Telegram from ue4hdh (Joel confirmed unused). RESTART REQUIRED finding: the agent's destination list + CLAUDE.local.md are baked into the system prompt at container spawn (container/agent-runner/src/index.ts calls buildSystemPromptAddendum once at startup). The live inbound.db 'destinations' table is updated by projectDestinationsToSessions on add/remove (so routing resolves), but a RUNNING container won't be AWARE of new destinations until respawn -- this is why Joel's Calcifer kept asking for Alicia's WhatsApp number. Restarted dm-with-joel (restarted:1, respawns on next msg) and dm-with-alicia (restarted:0, not running, spawns fresh on first a2a ping). Both now load new dests + persona. End-to-end round-trip test still pending Joel's confirmation.

---
▸ 2026-06-25T01:33:02Z
SHORN: Verified working end-to-end (Joel confirmed round-trip). Delivered option C cross-agent background messaging between dm-with-joel (tx7j2h) and dm-with-alicia (ue4hdh) using the v2 agent-to-agent module. Final wiring: tx7j2h has agent dest 'alicia'->ue4hdh; ue4hdh has agent dest 'joel'->tx7j2h plus channel dest 'alicia'->WhatsApp mg a6ea4196; Alicia's WhatsApp wiring set to session_mode=agent-shared so the a2a path and her WhatsApp conversation converge on one session. Persona/relay notes added to both groups' CLAUDE.local.md (peer-agent framing + provenance). Stray ue4hdh->Joel-Telegram channel dest removed. Key learnings: (1) the original 2026-04 send-only conclusion was a v1-era call; v2's agent-to-agent module is the right primitive (bidirectional, source_session_id reply routing, file forwarding, same <message to=> addressing). (2) ncl wirings create uses generic CRUD and does NOT auto-create the channel destination that createMessagingGroupAgent() would -- had to add the WhatsApp channel dest manually. (3) RESTART REQUIRED: destination list + CLAUDE.local.md are baked into the system prompt at container spawn; the inbound.db destinations table is routing-live but the agent stays awareness-stale until respawn (ncl groups restart). Does NOT preclude 5ecc group messaging -- a family-group agent can join as an a2a peer later (fan-out or broadcast-to-group-chat).
