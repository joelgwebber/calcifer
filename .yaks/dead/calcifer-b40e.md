---
id: calcifer-b40e
title: Add system notifications for new Open WebUI task chats
type: feature
priority: 2
created: '2026-03-07T23:04:26Z'
updated: '2026-04-18T20:19:19Z'
---

Enable desktop and mobile system notifications when NanoClaw creates new chat conversations in Open WebUI for scheduled tasks and reminders.

GOAL: Proactive notification when new chat appears without actively checking Open WebUI.

EXISTING INFRASTRUCTURE:
Open WebUI already has chat completion notifications, webhook integration, PWA support, and service worker infrastructure.

IMPLEMENTATION APPROACH:

Option A: Extend Open WebUI Native Notifications
- Leverage existing notification system
- Trigger on POST /api/chats/new
- Requires Open WebUI code modification

Option B: Custom Browser Notifications API
- Implement via Notifications API
- Request permission on first visit
- Click handler navigates to specific chat
- No Open WebUI modification needed

Option C: Service Worker Push Notifications
- Full PWA push notification support
- Works even when browser closed
- Requires VAPID keys and push server

RECOMMENDED: Hybrid B + C approach

NOTIFICATION TYPES:
- Task reminders (Zelle Edward)
- Background task completion
- Daily digests (Substack archiver)
- Error notifications

TECHNICAL STACK:
- Browser Notifications API
- Service Workers for PWA
- Push API for background notifications
- Click handlers to open specific chats

CONFIGURATION:
- OPENWEBUI_NOTIFICATIONS_ENABLED
- OPENWEBUI_NOTIFICATION_ICON
- OPENWEBUI_VAPID_PUBLIC_KEY
- OPENWEBUI_VAPID_PRIVATE_KEY

FALLBACK if permission denied:
- In-app badge counter
- Browser title updates
- Favicon badge
- Audio alerts

TESTING: Desktop (Chrome, Firefox, Safari, Edge), Mobile (Android PWA, iOS Safari)

DEPENDENCIES:
- calcifer-7696 (task notification chats)
- calcifer-5071 (HTTPS for PWA/notifications)

SUCCESS CRITERIA: System notification appears when task creates new chat, clicking opens specific chat, works on desktop and mobile.
