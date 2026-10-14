---
id: calcifer-b258
title: 'Hook up Life360 unofficial API for family location automation'
status: hairy
type: idea
priority: 3
created: '2026-08-29T18:08:58Z'
updated: '2026-08-29T18:08:58Z'
labels:
- life360
- automation
- api
---

Joel picked Life360 (2026-08-29) for family location sharing across all five family members (Lynn, Joel, Alicia, Anaïs, Jay). Life360 has no official developer API, only a community-maintained, reverse-engineered one (used by the Home Assistant integration; docs at krconv.github.io/life360-api-docs; REST base `https://www.life360.com/v3`, Bearer token via OAuth2 password grant). Joel asked to come back and try hooking it up so Calcifer can pull family locations for automation.

Known risks going in: violates Life360's ToS, and Life360 has had at least one API-related data exposure incident (440K+ users, per SC Media). Treat any integration as best-effort/non-critical — don't build anything load-bearing on it, and be ready for it to break if Life360 changes their backend. See `/workspace/extra/shared/family-wiki/family/apps-and-tools.md` for the full Life360 decision writeup.
