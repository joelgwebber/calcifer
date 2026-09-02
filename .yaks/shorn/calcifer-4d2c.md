---
id: calcifer-4d2c
title: 'Family peer-agent relay: wire Joel<->Anais and Joel<->Jay destinations + personas'
type: bug
priority: 2
created: '2026-09-02T02:27:48Z'
updated: '2026-09-02T02:29:37Z'
labels:
- ops,family
---

Gap from calcifer-2137: provisioned anais/jay logins but not the agent-to-agent peer relay. Joel's Calcifer had only an 'alicia' agent destination, so it couldn't address anais/jay ('doesn't think it can start a chat'). Mirror the working Alicia<->Joel pattern: bidirectional agent destinations (Joel: anais/jay; each member: joel) + persona sections (Joel's CLAUDE.local.md gains anais/jay peer notes; anais/jay gain a 'joel' peer note), then recycle Joel's container so writeDestinations picks them up.

---
▸ 2026-09-02T02:29:37Z
Done. Added bidirectional agent destinations: Joel gains anais->ag-3d5cbd65 and jay->ag-ce64578f; anais and jay each gain joel->ag-1777141351652. Added persona sections mirroring the Alicia relay: Joel's CLAUDE.local.md now names anais/jay as peer agents; anais/jay each got a 'joel' peer-agent note. Recycled Joel's container (restarted: 2) so writeDestinations + the composed persona pick them up on next spawn. Personas are gitignored (group folders); destinations live in the DB — only the yak record is committed.
