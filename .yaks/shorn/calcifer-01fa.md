---
id: calcifer-01fa
title: 'Cross-group agent messaging: family members can reach each other''s agents'
type: idea
priority: 3
created: '2026-04-19T22:34:10Z'
updated: '2026-04-22T03:31:31Z'
commit: 69040c9
---

Route a question or request to another family member's agent: 'Ask Alicia's agent what her schedule looks like next weekend.' Routed through main group. Privacy-preserving: the receiving agent decides what to share based on its own context.

### 2026-04-22T03:25:01Z
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
