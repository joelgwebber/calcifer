---
id: calcifer-569e.2
title: IMAP SEARCH-filtered results ordered oldest-first + hard-truncated at limit,
  hiding recent mail from high-volume senders
type: bug
priority: 2
created: '2026-08-23T15:06:35Z'
updated: '2026-08-23T15:16:11Z'
labels:
- fastmail
- mcp
- search
source: Joel + Calcifer investigation, 2026-08-23
parent: calcifer-569e
---

fastmail_list_messages with a search filter (e.g. FROM/SUBJECT) appears to return matches in ascending (oldest-first, roughly UID-ascending) order and hard-caps at the requested limit. For a high-volume sender (Alicia, hundreds of matches since 2008 in Archive), even limit=500 exhausted on years-old matches before reaching current mail — zero recent hits despite the target email being recent. Effectively makes search unusable for finding recent messages from prolific senders, regardless of how large a limit is requested. Suggested fix: either default to newest-first ordering for search results, or add a date-range / SINCE-first strategy to the skill's guidance, or expose sort order as a tool parameter.

---
▸ 2026-08-23T15:16:11Z
UID SEARCH already returns ascending UIDs so slice(-limit) kept the newest UIDs; the 'only old mail' symptom was really #1's parse race + unsorted output. Fixed: sort candidate UIDs asc then take newest 'limit', and sort displayed messages by date desc (newest-first), header now says 'newest first'. Also documented SINCE date-scoping + single-folder scope + INBOX/Archive tip in skills/fastmail/SKILL.md. Deeper cross-folder work tracked in .3.
