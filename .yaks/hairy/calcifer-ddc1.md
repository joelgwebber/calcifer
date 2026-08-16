---
id: calcifer-ddc1
title: 'Cards vs links vs unfurling: presentation model for referencing view records'
type: idea
priority: 3
created: '2026-08-16T19:12:27Z'
updated: '2026-08-16T19:12:27Z'
parent: calcifer-7c3a
labels:
- skill-views
---

When should the chat reference a view record as an inline LINK (app_link) vs an embedded CARD (send_record_card)? Working rule of thumb (now in interactive.instructions.md): link for a passing reference or a list of pointers; card when the record is the subject and the user will likely act (star/open). A card is essentially an unfurled link.

Owner intuition: cards are useful for summarization + quick actions (like Slack unfurling); underused today but likely to grow. Open direction worth exploring: CLIENT-SIDE UNFURLING — the agent just drops cheap app links (/app/<view>/<id>) and the web client decides whether to auto-expand them into record cards based on context/heuristics (single link on its own line -> unfurl; inline in a sentence -> stay a link). This would unify the two tools (link vs card becomes a presentation decision, not an agent decision) and reduce the agent's decision burden / rope. Connects to the source/presentation/context axes of the skill-views platform. Not urgent; think it through before committing.
