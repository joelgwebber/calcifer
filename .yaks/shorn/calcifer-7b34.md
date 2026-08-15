---
id: calcifer-7b34
title: 'skill-views: Wiki view — document/prose primitive + intra-view navigate'
type: feature
priority: 2
created: '2026-07-07T22:27:43Z'
updated: '2026-08-15T15:08:43Z'
depends_on:
- calcifer-851f
labels:
- skill-views
- wiki
---

Stretch skill-views to browse the wiki repo: 'find pages about X' -> a list of matching pages; open a page to read its prose; follow internal links to other pages without leaving the view. New primitives: document/prose (renders page body; MUST sanitize HTML) + an intra-view 'navigate' action (internal link -> another record in the same view, an in-app route, distinct from external 'open'). Data likely via data.type=http (custom-backend tier, calcifer-851f) against the wiki skill, or sqlite over the extracted wiki index if one exists. Watch: HTML/markdown sanitization for the prose primitive. Extracted from the retired calcifer-1d51.7 roadmap.

---
▸ 2026-08-15T15:01:57Z
Built: reusable <Prose> primitive (web/src/views/Prose.tsx) using react-markdown+remark-gfm (client deps, no host supply-chain gate; raw HTML inert by default). Source-agnostic — renders any markdown field. Link semantics delegated to context via onNavigate; ViewDetail wires intra-view .md navigation (relative-path resolve) + external->new tab. family-wiki view.json over Seafile fs source; leading YAML frontmatter stripped in the wiki context (Prose stays pure). Host+API verified. PENDING: user visual click-through (rail -> Family Wiki -> open a doc -> click an intra-wiki link).
