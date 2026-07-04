/**
 * Web-UI history reconstruction (calcifer-7c3a.2).
 *
 * The web frontend keeps its live transcript in an in-memory store, so a page
 * refresh loses it. Rather than invent a new persistence layer, we reuse the
 * nanoclaw-native session DBs (owner decision #4): on demand, merge a session's
 * `inbound.db` (messages_in → user turns) and `outbound.db` (messages_out →
 * assistant turns) into a single timestamp-ordered transcript.
 *
 * Read-only, always: we open both session DBs read-only and never write. The
 * outbound.db single-writer invariant is the container's — the host must not
 * touch it (see session-manager.ts header).
 *
 * Segregation: each thread is its own per-thread session (keyed on threadId),
 * so a thread's history comes ONLY from that session's DBs. A message sent in
 * thread A physically cannot appear in thread B's transcript — they live in
 * different files.
 */
import fs from 'fs';

import Database from 'better-sqlite3';

import { getMessagingGroupByPlatform } from '../db/messaging-groups.js';
import { findSession, getActiveSessionsByMessagingGroup } from '../db/sessions.js';
import { log } from '../log.js';
import { inboundDbPath, outboundDbPath } from '../session-manager.js';

const CHANNEL_TYPE = 'web';

export interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Epoch milliseconds (UTC). Matches the client store's MyMessage.createdAt. */
  createdAt: number;
}

export interface ThreadSummary {
  threadId: string;
  title: string;
  /** Epoch milliseconds (UTC). */
  lastActive: number;
}

/**
 * Normalize a session-DB timestamp to epoch ms (UTC).
 *
 * inbound.db rows carry ISO-8601 strings (`2026-07-04T17:40:01.140Z`) written
 * by the channel adapter, while outbound.db rows carry SQLite `datetime('now')`
 * output (`2026-07-04 17:44:35`) — UTC but with no zone marker and a space
 * separator. Left as-is, `Date.parse` would read the latter as LOCAL time,
 * shifting it by the host's UTC offset and scrambling the merge order. So we
 * coerce the space-form to explicit UTC before parsing.
 */
function toEpoch(ts: string | null | undefined): number {
  if (!ts) return 0;
  const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Pull the display text out of a message row's JSON content blob. */
function extractText(contentJson: string): string | null {
  try {
    const c = JSON.parse(contentJson) as unknown;
    if (typeof c === 'string') return c;
    if (c && typeof c === 'object' && typeof (c as { text?: unknown }).text === 'string') {
      return (c as { text: string }).text;
    }
  } catch {
    // Non-JSON content — ignore (nothing sensible to render).
  }
  return null;
}

function openReadonly(dbPath: string): Database.Database | null {
  if (!fs.existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly: true });
  db.pragma('busy_timeout = 5000');
  return db;
}

function truncate(text: string, max = 40): string {
  const t = text.trim();
  return t.length <= max ? t : t.slice(0, max).trimEnd() + '…';
}

/**
 * Full timestamp-ordered transcript for one web thread. Returns [] when the
 * thread has never been opened (no session yet) or the messaging group is
 * unknown — the client treats that as "start fresh".
 */
export function loadThreadHistory(platformId: string, threadId: string): HistoryMessage[] {
  const mg = getMessagingGroupByPlatform(CHANNEL_TYPE, platformId);
  if (!mg) return [];
  const session = findSession(mg.id, threadId);
  if (!session) return [];

  const messages: HistoryMessage[] = [];

  const inDb = openReadonly(inboundDbPath(session.agent_group_id, session.id));
  if (inDb) {
    try {
      const rows = inDb
        .prepare("SELECT id, timestamp, content FROM messages_in WHERE kind IN ('chat', 'chat-sdk') ORDER BY seq ASC")
        .all() as Array<{ id: string; timestamp: string; content: string }>;
      for (const r of rows) {
        const text = extractText(r.content);
        if (text) messages.push({ id: r.id, role: 'user', text, createdAt: toEpoch(r.timestamp) });
      }
    } finally {
      inDb.close();
    }
  }

  const outDb = openReadonly(outboundDbPath(session.agent_group_id, session.id));
  if (outDb) {
    try {
      const rows = outDb
        .prepare("SELECT id, timestamp, content FROM messages_out WHERE kind = 'chat' ORDER BY seq ASC")
        .all() as Array<{ id: string; timestamp: string; content: string }>;
      for (const r of rows) {
        const text = extractText(r.content);
        if (text) messages.push({ id: r.id, role: 'assistant', text, createdAt: toEpoch(r.timestamp) });
      }
    } finally {
      outDb.close();
    }
  }

  // Stable timestamp order. Ties (same-second inbound/outbound) keep insertion
  // order, which puts the user turn before its reply — the natural reading.
  messages.sort((a, b) => a.createdAt - b.createdAt);
  return messages;
}

/**
 * The web thread list: one entry per active per-thread session on the web
 * messaging group, newest first, titled from its first user message.
 */
export function listThreads(platformId: string): ThreadSummary[] {
  const mg = getMessagingGroupByPlatform(CHANNEL_TYPE, platformId);
  if (!mg) return [];

  const summaries: ThreadSummary[] = [];
  for (const session of getActiveSessionsByMessagingGroup(mg.id)) {
    if (!session.thread_id) continue; // per-thread sessions only

    let title = 'Conversation';
    const inDb = openReadonly(inboundDbPath(session.agent_group_id, session.id));
    if (inDb) {
      try {
        const row = inDb
          .prepare("SELECT content FROM messages_in WHERE kind IN ('chat', 'chat-sdk') ORDER BY seq ASC LIMIT 1")
          .get() as { content: string } | undefined;
        if (row) {
          const text = extractText(row.content);
          if (text) title = truncate(text);
        }
      } catch (err) {
        log.warn('web history: failed to read thread title', { sessionId: session.id, err });
      } finally {
        inDb.close();
      }
    }

    summaries.push({
      threadId: session.thread_id,
      title,
      lastActive: toEpoch(session.last_active ?? session.created_at),
    });
  }

  summaries.sort((a, b) => b.lastActive - a.lastActive);
  return summaries;
}
