---
id: calcifer-4d85
title: Add Twilio SMS integration for universal family access
type: feature
priority: 3
created: '2026-03-07T04:18:07Z'
updated: '2026-04-22T23:05:21Z'
---

SMS support via Twilio for quick access without apps. Cost: ~$0.028/message. Lower priority than Open WebUI.

## Status (2026-04-18)

Code is done and wired up (`src/channels/twilio.ts`). Webhook confirmed working at `http://hearth.hamlet-algol.ts.net:8767/`.

Blocked on Twilio compliance:
- US local long codes require A2P 10DLC registration — too painful for personal use
- Switched to toll-free number +1 (833) 456-1004
- Toll-free verification requires an approved Trust Hub Customer Profile
- Customer Profile submitted, currently in **manual review (3-5 business days)**

Once the profile is approved, resume toll-free verification in Twilio console under
Messaging → Regulatory Compliance, then register a group:

```bash
npx tsx setup/index.ts --step register -- \
  --jid "sms:+1XXXXXXXXXX" --name "Joel" \
  --folder "sms_joel" --channel sms \
  --trigger "@Calcifer" --no-trigger-required --is-main
```

Credentials already in `.env` and `data/env/env`. Service is running.
