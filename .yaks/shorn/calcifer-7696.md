---
id: calcifer-7696
title: Fix Open WebUI conversation isolation and add task notification chats
type: feature
priority: 2
created: '2026-03-07T22:57:15Z'
updated: '2026-03-08T01:11:09Z'
commit: 1bed0c3
---

Fix HTTP API conversation isolation and enable task notifications to appear as new chat instances in Open WebUI.

PROBLEM 1: Shared Chat History
All Open WebUI conversations share same NanoClaw chat ID (web:api), causing context leakage.

SOLUTION 1: Per-Conversation Chat IDs
Open WebUI sends chat_id in requests (v0.6.17+):
- Extract chat_id from request body or headers
- Generate unique NanoClaw JID: web:chat_{chat_id}
- Each conversation gets isolated history
- No Open WebUI code changes needed

Implementation (http-server.ts):
1. Parse chat_id from OpenAI request body
2. Use chat_id || generate fallback ID for legacy requests
3. Pass unique JID to agent runner
4. Test cross-conversation isolation

PROBLEM 2: Task Notifications Invisible
Scheduled tasks run but output only goes to Telegram. Open WebUI users never see results.

SOLUTION 2: Task Notifications as New Chats
Use Open WebUI API to create new conversations when tasks complete.

Open WebUI API Support:
- POST /api/chats/new or /api/v1/chats/new
- Accepts: model, title, system, messages array
- Creates new chat visible in UI
- User can interact with results

Implementation Flow:
1. Task completes (e.g., Zelle reminder at 9 AM)
2. NanoClaw calls Open WebUI API
3. POST /api/chats/new with task results
4. New chat appears: "Reminder: Zelle Edward"
5. User can respond or dismiss

Example API Call:
POST https://openwebui.example.com/api/chats/new
Authorization: Bearer {token}
{
  "model": "sparky",
  "title": "Reminder: Zelle 00 to Edward",
  "messages": [{
    "role": "assistant",
    "content": "Reminder: Zelle 00 to Edward today"
  }]
}

PROBLEM 3: No System Notifications
Users must actively check Open WebUI to see new task chats. Need proactive notifications.

SOLUTION 3: Browser Push Notifications
Use Web Push API + Service Workers for system notifications when new chats created.

Options:
A. Open WebUI native notifications (check if exists)
B. Custom service worker + Push API
C. Desktop notifications via Notifications API
D. Browser extension for notifications

Research needed:
- Does Open WebUI have notification support?
- Service worker registration
- Push notification permissions
- Notification click handlers

IMPLEMENTATION PLAN:

Phase 1: Conversation Isolation (Quick Win)
1. Read http-server.ts request handling
2. Extract chat_id from request body/headers
3. Generate web:chat_{id} JID
4. Pass to agent runner
5. Test multiple conversations don't leak context
6. Verify session continuity works

Phase 2: Task Notification System
1. Add Open WebUI client to NanoClaw
2. Store Open WebUI URL and API token in env
3. When task completes:
   - Format task output for chat
   - POST to /api/chats/new
   - Generate unique chat ID
   - Set appropriate title
4. Handle errors gracefully
5. Test with scheduled reminders

Phase 3: System Notifications
1. Research Open WebUI notification capabilities
2. If exists: Use native system
3. If not: Implement custom solution:
   - Service worker for push notifications
   - Permission request on first visit
   - Notification triggers on new chat
   - Click handler opens specific chat
4. Fallback: Browser Notifications API
5. Test on desktop and mobile

USE CASES:

Scenario 1: Daily Reminders
- 9 AM: Zelle reminder task runs
- New chat created: "Reminder: Zelle Edward"
- System notification: "New reminder from Sparky"
- User clicks notification, opens chat
- Responds: "Done" or "Remind me tomorrow"

Scenario 2: Background Research
- Long-running research task completes
- New chat: "Research Complete: Discord Integration"
- Notification alerts user
- Full results pre-populated in chat
- User asks follow-up questions

Scenario 3: Daily Digest
- 6 AM: Substack archiver runs
- New chat: "Daily Digest - 3 articles archived"
- Notification shows count
- User can read summaries or dismiss

Scenario 4: Multiple Conversations
- Chat A: Researching Discord
- Chat B: Planning Tailscale setup
- Each isolated, no context leakage
- Can switch between without confusion

TECHNICAL REQUIREMENTS:

Conversation Isolation:
- Parse OpenAI chat completion request
- Extract chat_id from body or headers
- Map to stable NanoClaw JID
- Handle missing chat_id gracefully

Task Notifications:
- Open WebUI base URL (env: OPENWEBUI_URL)
- API authentication token (env: OPENWEBUI_API_KEY)
- HTTP client for POST requests
- Error handling and retries
- Chat title generation
- Message formatting

System Notifications:
- Service Worker registration
- Push notification permissions
- Web Push API integration
- Notification click handlers
- Fallback to Notifications API
- Mobile compatibility

CONFIGURATION:

New env variables:
- OPENWEBUI_URL=https://openwebui.example.com
- OPENWEBUI_API_KEY=bearer_token_here
- OPENWEBUI_NOTIFICATIONS_ENABLED=true

BENEFITS:
- Proper conversation isolation
- Task results visible in UI
- Interactive notifications
- Proactive alerts
- Unified interface
- Better UX for scheduled tasks

REFERENCES:
- Open WebUI API: docs.openwebui.com/reference/api-endpoints
- Backend-Controlled Flow: docs.openwebui.com/tutorials/integrations
- Web Push API: developer.mozilla.org/en-US/docs/Web/API/Push_API
- Notifications API: developer.mozilla.org/en-US/docs/Web/API/Notifications_API
- Service Workers: developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
