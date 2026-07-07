---
id: calcifer-828a
title: 'Web chat: scope thread-list + history to the user''s current agent group'
type: bug
priority: 1
created: '2026-07-07T20:10:37Z'
updated: '2026-07-07T20:12:13Z'
labels:
- web-ui
---

BUG exposed by re-pointing web:joel (The Hearth -> dm-with-joel): web-history.listThreads(mg) + loadThreadHistory via findSession(mg,thread) span ALL agent groups for a messaging group. After a rewire, a thread_id can have sessions under >1 agent group -> duplicate thread rows in the UI with the same threadId (both 'select' together), and history-load reads the wrong (orphaned) session -> the live chat looks 'lost'. Fix: resolve the user's current agent group (mg -> messaging_group_agents) and scope listThreads to that agent group + use findSessionForAgent(agentGroupId,mg,thread) for history. Also close the orphaned the-hearth session (sess-1783222758978-2l8q34, thread auth-test-1). Prevents cross-agent leakage generally.

---
▸ 2026-07-07T20:12:13Z
Fixed + verified. web-history.ts now resolves the messaging group's CURRENT agent group (currentAgentGroupId via getMessagingGroupAgents) and scopes both listThreads (filter sessions to that agent group) and loadThreadHistory (findSessionForAgent instead of findSession). Closed the orphaned the-hearth session (sess-1783222758978-2l8q34). Verified via curl as web:joel: /api/threads shows auth-test-1 ONCE (was twice); /api/history returns the recovered 5-message add-apartments conversation (was shadowed by the the-hearth session). Root cause was the web:joel rewire (The Hearth->dm-with-joel) leaving cross-agent-group sessions for the same (mg,thread).
