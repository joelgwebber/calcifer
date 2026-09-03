---
id: calcifer-eedc
title: Relay fidelity + surface-reliability guidance (persona/skill)
type: task
priority: 2
created: '2026-09-02T03:32:08Z'
updated: '2026-09-03T16:19:39Z'
parent: calcifer-dc2b
labels:
- agent-to-agent
---

Owner decisions #2 + #4, delivered as guidance not code flags. #2 Fidelity: interpretation welcome on BOTH ends (sender's context to read intent, receiver's to render usefully) WITH explicit guidance to preserve the FULL intent and semantics of a forwarded message — a persona/framing norm. #4 Drop risk: guidance to surface a relayed/pushed message unless a strong reason not to, then observe. Author into the relevant CLAUDE.local.md persona sections and/or a container skill. Structurally independent of the plumbing slices.

---
▸ 2026-09-03T16:19:39Z
SHORN. Added a consistent 'Relay conduct — all peer messaging (calcifer-eedc)' block to all four family groups' CLAUDE.local.md (dm-with-joel/alicia/anais/jay). Three always-on norms (skills are on-demand/description-gated, too unreliable for decision #4, so this lives in the always-in-prompt persona):
1. Always confirm back to your human after relaying — never end a turn with only the <message to=…> block (this is the behavioral half of calcifer-4dad: Joel got no 'sent it').
2. Preserve the FULL intent (decision #2) — interpretation welcome both ends, but carry the complete ask/specifics/caveats; don't summarize away substance.
3. Surface what you receive unless a strong reason not to (decision #4).
Symmetric block (applies to both sending and surfacing), so every group got the same text. Recycled all four groups (joel restarted:1 live; alicia/anais/jay cold → pick up on next spawn). Implementation is install-local (CLAUDE.local.md gitignored); this yak is the tracked record. Note: CLAUDE.local.md is baked at spawn (01fa finding), so the recycle is what makes it take effect.
