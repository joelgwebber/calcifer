---
id: calcifer-6d7a
title: Add Telegram as primary channel for NanoClaw
type: feature
priority: 2
created: '2026-03-05T04:17:48Z'
updated: '2026-03-05T06:22:31Z'
commit: ef8ba70
---

Replace WhatsApp with Telegram as the primary messaging interface for NanoClaw. Telegram offers better stability, no ban risk, free unlimited messaging, and excellent mobile apps.

## Why Telegram?

**Current pain**: WhatsApp via Baileys has high ban risk, requires personal phone number, unstable reverse-engineered API

**Telegram benefits**:
- Official Bot API (no ban risk, no reverse engineering)
- Free unlimited messages (no rate limits)
- 5-minute setup (create bot via @BotFather)
- Best-in-class mobile/desktop/web apps
- Rich features (inline keyboards, voice, files, code formatting)
- No business verification required
- Zero maintenance (official API, stable)

## Implementation

NanoClaw already has `/add-telegram` skill that:
- Adds TelegramChannel class (src/channels/telegram.ts)
- Implements full Channel interface
- Includes 46 unit tests
- Uses skills engine for deterministic code changes
- Supports replacing WhatsApp or running alongside

## Setup Steps

1. Run `/add-telegram` skill
2. Create bot via @BotFather on Telegram
3. Get bot token
4. Add to .env: TELEGRAM_BOT_TOKEN
5. Configure: replace WhatsApp or run alongside
6. Test with Sparky

## Context

Research in 2026 shows Telegram is the #1 choice for personal AI assistants (Moltbot, OpenClaw, etc all use Telegram). WhatsApp is literally the worst option due to ban risk and reverse-engineering requirements.

## Next Steps

After Telegram is working:
- Consider retiring WhatsApp/Baileys entirely
- Document Telegram as primary channel in README
- Update setup guides to recommend Telegram
