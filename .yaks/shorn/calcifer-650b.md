---
id: calcifer-650b
title: 'Web thread list: cross-session echo bumps sibling last_active, burying the active conversation (''vanished on refresh'')'
type: bug
priority: 1
created: '2026-08-30T23:54:45Z'
updated: '2026-08-31T00:03:52Z'
labels:
- web-ui,cross-session-context
---

SYMPTOM: user starts a web chat (user:joel, a Journavx medication question), it 'seems to hang', and on refresh the conversation is gone from the sidebar.

EVIDENCE (nothing was lost): session sess-1788132782121-bze7io (thread 6248f6e9…) is active on web:joel's mg (mg-1783222725859-nqvjgr) under dm-with-joel, not archived (no thread_meta row). Its inbound.db has the Journavx question as channel_type='web' (seq 26, 23:33:02) and outbound.db has the agent's reply (seq 27, 23:33:33, ~31s later). So the session, message, and reply all persisted correctly.

ROOT CAUSE (burial by last_active pollution): listThreads() → getActiveSessionsByMessagingGroup orders by 'last_active DESC' (src/db/sessions.ts:102). The cross-session-context fan (src/modules/cross-session-context/fan.ts) copies each triggering user message AND each delivered agent reply into every SIBLING session via writeSessionMessage(), which unconditionally does updateSession(sessionId,{last_active: now}) (src/session-manager.ts:312). So when the Journavx turn ran, all ~12+ of joel's other web sessions got last_active=23:33:34 — newer than the Journavx thread's own last_active (23:33:02, its inbound time; the thread is NOT re-bumped on its own agent reply). Result: the just-used thread sinks BELOW every re-stamped sibling (measured position: 27th). On refresh, hydrateThreadList sets currentThreadId=threadIds[0] = a fan-bumped OLD thread, and the new one is buried 26 deep → 'gone'. Side effect: every conversation falsely reads 'active just now', corrupting recency + B5 time-bucketing. Happens on ~every turn, not just this one.

FIX DIRECTIONS: (1, root) don't bump last_active for cross-session ECHO writes — echoes are ambient context, not activity in the sibling thread; give writeSessionMessage an option (or a dedicated echo-write path) that skips the last_active stamp when kind is the echo channel (ECHO_CHANNEL_TYPE='session-echo'). (2) bump the ORIGINATING thread's last_active on agent reply / turn completion so an active conversation rises to the top (today it only bumps on inbound). (3, defense-in-depth) have listThreads derive recency from the newest non-echo (channel_type='web') message rather than raw sessions.last_active, insulating the list from echo pollution. Relates to calcifer-a7b7 (conversation sort order).

SEPARATE/secondary: the '~hung' feel — the reply took ~31s and may not have rendered live (SSE turn-boundary/status). Likely distinct from the burial; note but don't conflate.

---
▸ 2026-08-31T00:03:52Z
Fixed (option 1, root cause): writeSessionMessage gained an opts.bumpLastActive (default true); the cross-session fan echo write (fan.ts) passes bumpLastActive:false so ambient echoes no longer re-stamp sibling sessions' last_active — the active thread stays on top of the web list. Added a fan.test.ts regression asserting a sibling's last_active stays null after a fan. tsc + 20 fan tests pass. Host code → built + service restart to deploy. NOTE: existing sessions still carry the old bumped timestamps; the list self-heals as threads are used (offer a one-off recompute if desired).
