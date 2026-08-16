---
id: calcifer-44ab.3
title: Retire Twilio SMS credentials and channel
type: task
priority: 3
created: '2026-04-22T23:05:34Z'
updated: '2026-04-23T04:54:35Z'
parent: calcifer-44ab
---

Once Android SMS is live: remove TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER from .env. Archive or delete src/channels/twilio.ts. Optionally release the Twilio number if we're paying for it.
