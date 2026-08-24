---
name: fastmail
description: Fastmail email, calendar, and contacts via IMAP/CalDAV/CardDAV. Use when the user wants to read or send email, check or create calendar events, or look up contacts.
allowed-tools: mcp__fastmail__*
env-guard: FASTMAIL_EMAIL
---

# Fastmail Email, Calendar, and Contacts

## Email Tools

**mcp__fastmail__fastmail_list_folders** — List all mailboxes

**mcp__fastmail__fastmail_list_messages** — List messages in a folder
- `folder` (default: INBOX), `limit` (default: 20), `search` (optional IMAP criteria)
- Results are returned **newest-first**, and `limit` keeps the most recent matches. So for a prolific sender you still see their latest mail without raising `limit`.
- Search examples: `["UNSEEN"]`, `["FROM", "user@example.com"]`, `["SUBJECT", "invoice"]`
- To scope by date, add `SINCE` with a `DD-Mon-YYYY` date, e.g. `["FROM", "user@example.com", "SINCE", "01-Aug-2026"]`. This is far cheaper than paging with a large `limit`.
- `list_messages` searches **one folder at a time**. If you don't know where a message lives, check both `INBOX` and `Archive` (most Fastmail mail is auto-archived); use `fastmail_list_folders` to enumerate the rest.

**mcp__fastmail__fastmail_read_message** — Read full message content
- `folder`, `uid` (from list_messages)

**mcp__fastmail__fastmail_send_message** — Send an email
- `to`, `subject`, `body`, `cc` (optional), `bcc` (optional)

## Calendar Tools

**mcp__fastmail__fastmail_list_calendars** — List all calendars

**mcp__fastmail__fastmail_list_events** — List events in a date range
- `calendar` (default: Default), `start_date` (ISO 8601), `end_date` (ISO 8601)

**mcp__fastmail__fastmail_create_event** — Create a calendar event
- `calendar`, `summary`, `start` (ISO 8601), `end` (ISO 8601), `description` (optional), `location` (optional)

## Contacts Tools

**mcp__fastmail__fastmail_list_contacts** — List all contacts
- `limit` (default: 50)

**mcp__fastmail__fastmail_search_contacts** — Search contacts by name or email
- `query`

## Example

```
# List recent emails
mcp__fastmail__fastmail_list_messages(folder="INBOX", limit=10)

# Read a message
mcp__fastmail__fastmail_read_message(folder="INBOX", uid=1234)

# Send email
mcp__fastmail__fastmail_send_message(to="someone@example.com", subject="Hello", body="Message here")

# Upcoming events
mcp__fastmail__fastmail_list_events(calendar="Default", start_date="2026-04-18T00:00:00Z", end_date="2026-04-25T23:59:59Z")

# Create event
mcp__fastmail__fastmail_create_event(calendar="Default", summary="Team Meeting", start="2026-04-20T10:00:00Z", end="2026-04-20T11:00:00Z")

# Search contacts
mcp__fastmail__fastmail_search_contacts(query="john")
```
