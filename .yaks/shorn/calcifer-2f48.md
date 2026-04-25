---
id: calcifer-2f48
title: Fix Open WebUI response streaming - messages stuck until chat reopened
type: bug
priority: 1
created: '2026-03-07T23:17:47Z'
updated: '2026-03-08T18:34:49Z'
commit: 0fbc9c7
---

HTTP API responses get stuck and never display in Open WebUI until user closes and reopens the chat. Response appears to be buffered indefinitely instead of streaming properly.

OBSERVED BEHAVIOR:
- User sends message in Open WebUI
- Response never appears (indefinite wait, not just slow)
- Closing and reopening chat immediately shows the response
- Indicates response is generated but not delivered to UI

ROOT CAUSE ANALYSIS:

Current implementation (http-server.ts lines 254-299):
- Agent callback sends ONE chunk with full response
- Only sends when output.result is available
- Completes stream when status === success
- Missing intermediate streaming and keep-alive

SPECIFIC ISSUES:

1. Single Chunk Delivery (Line 256-288)
Agent callback waits for complete output.result, sends entire response as one chunk. Open WebUI may not render until final [DONE] signal.

2. No Stream Flushing
After res.write(), stream is not flushed. Data may be buffered by Node.js until connection closes.

3. No Keep-Alive Chunks
Long agent runs have no periodic heartbeat. SSE connection may appear stale to browser.

4. Agent Runner Callback Behavior
Need to verify if agent runner calls callback incrementally or only at end. If only at end, need to change agent runner too.

DIAGNOSTIC FINDINGS:

From user testing:
- Duration: Indefinite (minutes+, not seconds)
- Happens consistently, not intermittent
- Only resolves by closing/reopening chat
- Response IS generated (appears after reopen)

This confirms: Response generated correctly but streaming delivery broken.

PROPOSED FIXES:

Fix 1: Add Stream Flushing (Quick Win)
After each res.write(), explicitly flush if available. Some Node.js versions support res.flush() or res.flushHeaders().

Fix 2: Send Immediate Acknowledgment
Send empty chunk immediately when request received to establish SSE connection and verify it works.

Fix 3: Keep-Alive Heartbeat
Send comment chunks every 15-30 seconds during agent run to prevent timeout:
res.write(': keepalive\n\n')

Fix 4: Incremental Streaming
Modify agent runner to call callback with partial results as agent generates output, not just final result.

Fix 5: Proper SSE Connection Setup
Ensure all required SSE headers set:
- Content-Type: text/event-stream
- Cache-Control: no-cache
- Connection: keep-alive
- X-Accel-Buffering: no (for nginx proxy)

IMPLEMENTATION PLAN:

Phase 1: Quick Fixes (Minimal Changes)
1. Add res.flushHeaders() after setting SSE headers
2. Send initial empty delta to establish connection
3. Add X-Accel-Buffering: no header for proxy compatibility
4. Test if this resolves issue

Phase 2: Keep-Alive (If Phase 1 Insufficient)
1. Start interval timer when agent run begins
2. Send comment chunks every 15 seconds
3. Clear interval when response completes
4. Prevents connection timeout

Phase 3: True Incremental Streaming (Best Solution)
1. Modify agent runner to stream output incrementally
2. Agent calls callback multiple times with partial results
3. Each partial result sent as separate SSE chunk
4. True streaming experience, see response as generated

TESTING REQUIREMENTS:

Test Cases:
1. Short response (< 1 second) - should work immediately
2. Medium response (5-10 seconds) - should stream or show quickly
3. Long response (30+ seconds) - should show progress or keep-alive
4. Very long response (2+ minutes) - should not timeout

Browsers:
- Chrome/Edge (primary)
- Firefox
- Safari (may have different SSE behavior)

Network Conditions:
- Direct connection
- Behind reverse proxy (nginx/caddy)
- Mobile network (slower, may have different buffering)

TEMPORARY WORKAROUND:

For users experiencing this now:
- Close and reopen chat to see response
- Or wait for response in Network tab, refresh page
- Response IS being generated, just not displayed

CODE LOCATIONS:

Primary: /workspace/project/src/http-server.ts
- Lines 220-223: SSE headers setup
- Lines 254-299: Agent callback and streaming
- Lines 269-286: Chunk creation and sending

Related: Agent runner (need to check callback behavior)

EXPECTED OUTCOME:

After fix:
- Response appears immediately as generated
- Or at minimum, appears within 1-2 seconds
- No need to close/reopen chat
- Smooth streaming experience

PRIORITY: P1 (Critical)
This breaks core Open WebUI functionality. Users cannot get responses without workaround. Blocks adoption of Open WebUI interface.

Related Yaks:
- calcifer-e591: HTTP API lacks agent context/tools
- calcifer-7696: Conversation isolation and task notifications
