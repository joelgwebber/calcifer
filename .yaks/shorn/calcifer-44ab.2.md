---
id: calcifer-44ab.2
title: Implement android-sms-gateway channel module
type: task
priority: 2
created: '2026-04-22T23:05:34Z'
updated: '2026-04-23T04:52:29Z'
parent: calcifer-44ab
---

New src/channels/sms-android.ts replacing twilio.ts. Outbound: POST to android-sms-gateway API (http://tailscale-ip:8080/api/v1/message). Inbound: configure phone webhook to POST to Calcifer HTTP API. JID format: sms:+1XXXXXXXXXX. Mirror existing twilio.ts channel structure.
