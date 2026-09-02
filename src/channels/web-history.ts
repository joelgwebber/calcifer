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

import { getAgentGroup } from '../db/agent-groups.js';
import {
  getMessagingGroupAgents,
  getMessagingGroupByPlatform,
  getMessagingGroupsByAgentGroup,
} from '../db/messaging-groups.js';
import { findSessionForAgent, getActiveSessionsByMessagingGroup } from '../db/sessions.js';
import { getThreadMetaFor, setThreadArchived, setThreadPinned, setThreadTitle } from '../db/thread-meta.js';
import { getUser } from '../modules/permissions/db/users.js';
import { type Correspondent, parseCorrespondent } from '../correspondent.js';
import { log } from '../log.js';
import { inboundDbPath, outboundDbPath } from '../mailbox/sqlite/index.js';
import { type WebCard } from './web-cards.js';
import { cardFromContent } from './web-views.js';

const CHANNEL_TYPE = 'web';

/** A prompt (ask_user_question / approval) as reconstructed from history. */
export interface HistoryQuestion {
  questionId: string;
  title: string;
  question: string;
  options: Array<{ label: string; value: string; selectedLabel: string }>;
  /** History-loaded prompts are inert — we can't confirm they're still pending. */
  resolved: true;
}

export interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Epoch milliseconds (UTC). Matches the client store's MyMessage.createdAt. */
  createdAt: number;
  /** Structured card (send_card), when the row is a display card (calcifer-7c3a.4). */
  card?: WebCard;
  /** Interactive prompt (ask_question), rendered inert on reload (calcifer-7c3a.5). */
  question?: HistoryQuestion;
}

export interface ThreadSummary {
  threadId: string;
  title: string;
  /** Epoch milliseconds (UTC). */
  lastActive: number;
  /** Pinned to the top of the list (reserved for B5 — pin/bucketing). */
  pinned?: boolean;
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

/** Parse a display card (send_card) out of a message row's JSON content blob. */
async function extractCard(contentJson: string): Promise<WebCard | null> {
  try {
    return await cardFromContent(JSON.parse(contentJson));
  } catch {
    return null;
  }
}

/** Parse an interactive prompt (ask_question) out of a message row's content. */
function extractQuestion(contentJson: string): HistoryQuestion | null {
  try {
    const c = JSON.parse(contentJson) as Record<string, unknown>;
    if (c.type !== 'ask_question' || typeof c.questionId !== 'string' || !Array.isArray(c.options)) return null;
    return {
      questionId: c.questionId,
      title: typeof c.title === 'string' ? c.title : '',
      question: typeof c.question === 'string' ? c.question : '',
      options: c.options as HistoryQuestion['options'],
      resolved: true,
    };
  } catch {
    return null;
  }
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

/** Human-ish label from a channel platform_id or bare source (`web:joel` → `Joel`). */
function prettifyHandle(value: string): string {
  const handle = value.includes(':') ? value.slice(value.indexOf(':') + 1) : value;
  return handle ? handle.charAt(0).toUpperCase() + handle.slice(1) : value;
}

/**
 * Human label for a thread's correspondent (calcifer-bd2f). For a peer agent,
 * resolve the person behind the peer agent group: its web messaging group's
 * user display_name (e.g. `Joel`, `Anaïs`), falling back to a prettified handle,
 * then the agent group name. For a system source, prettify the source label
 * (`reminders` → `Reminders`).
 */
async function correspondentLabel(c: Correspondent): Promise<string> {
  if (c.kind === 'system') return prettifyHandle(c.ref);
  const groups = await getMessagingGroupsByAgentGroup(c.ref);
  const web = groups.find((mg) => mg.channel_type === CHANNEL_TYPE);
  if (web) {
    const user = await getUser(web.platform_id);
    if (user?.display_name && user.display_name.trim()) return user.display_name.trim();
    return prettifyHandle(web.platform_id);
  }
  const ag = await getAgentGroup(c.ref);
  return ag?.name ?? c.ref;
}

/**
 * The agent group the web messaging group is CURRENTLY wired to. Thread list
 * and history must scope to this — a messaging group can accumulate sessions
 * under multiple agent groups over time (e.g. after an admin re-points the
 * wiring), and without scoping those stale sessions surface as duplicate
 * threads (same threadId) and shadow the live session's history.
 */
async function currentAgentGroupId(mgId: string): Promise<string | null> {
  const agents = await getMessagingGroupAgents(mgId);
  return agents.length > 0 ? agents[0].agent_group_id : null;
}

/**
 * Full timestamp-ordered transcript for one web thread. Returns [] when the
 * thread has never been opened (no session yet) or the messaging group is
 * unknown — the client treats that as "start fresh".
 */
export async function loadThreadHistory(platformId: string, threadId: string): Promise<HistoryMessage[]> {
  const mg = await getMessagingGroupByPlatform(CHANNEL_TYPE, platformId);
  if (!mg) return [];
  const agentGroupId = await currentAgentGroupId(mg.id);
  if (!agentGroupId) return [];
  const session = await findSessionForAgent(agentGroupId, mg.id, threadId);
  if (!session) return [];

  const messages: HistoryMessage[] = [];

  const inDb = openReadonly(inboundDbPath(session.agent_group_id, session.id));
  if (inDb) {
    try {
      // Scope to THIS thread's real web turns. Cross-session-context echo rows
      // also ride in messages_in as kind='chat' but with channel_type
      // 'session-echo' (and carry BOTH user and agent sibling messages), and
      // on_wake/system rows arrive as channel_type 'agent'. Both are ambient
      // context for the agent, not transcript — without this filter they render
      // as bogus 'user' turns (every chat sprouts ~20 mixed messages all
      // attributed to the user). channel_type='web' keeps only genuine user
      // messages; assistant turns come from outbound.db below.
      const rows = inDb
        .prepare(
          "SELECT id, timestamp, content FROM messages_in WHERE kind IN ('chat', 'chat-sdk') AND channel_type = ? ORDER BY seq ASC",
        )
        .all(CHANNEL_TYPE) as Array<{ id: string; timestamp: string; content: string }>;
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
      // 'chat' = plain assistant text; 'chat-sdk' = structured (send_card).
      const rows = outDb
        .prepare("SELECT id, timestamp, content FROM messages_out WHERE kind IN ('chat', 'chat-sdk') ORDER BY seq ASC")
        .all() as Array<{ id: string; timestamp: string; content: string }>;
      for (const r of rows) {
        const card = await extractCard(r.content);
        if (card) {
          messages.push({
            id: r.id,
            role: 'assistant',
            text: card.fallbackText ?? '',
            card,
            createdAt: toEpoch(r.timestamp),
          });
          continue;
        }
        const question = extractQuestion(r.content);
        if (question) {
          messages.push({ id: r.id, role: 'assistant', text: '', question, createdAt: toEpoch(r.timestamp) });
          continue;
        }
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

interface EnrichedThread extends ThreadSummary {
  archived: boolean;
}

/**
 * Every per-thread session on the web messaging group, enriched with its
 * thread_meta (calcifer-3236 / B0): a persisted title override wins over the
 * first-message title, and archive/pin state ride along. listThreads and
 * listArchivedThreads partition this by `archived`.
 */
async function enrichedThreads(platformId: string): Promise<EnrichedThread[]> {
  const mg = await getMessagingGroupByPlatform(CHANNEL_TYPE, platformId);
  if (!mg) return [];

  const agentGroupId = await currentAgentGroupId(mg.id);
  if (!agentGroupId) return [];

  const base: Array<{ threadId: string; title: string; lastActive: number }> = [];
  for (const session of await getActiveSessionsByMessagingGroup(mg.id)) {
    if (session.agent_group_id !== agentGroupId) continue; // scope to the current wiring
    if (!session.thread_id) continue; // per-thread sessions only

    // A per-correspondent thread (calcifer-226a) is titled by WHO it's with
    // ("Joel", "Reminders"), derived from the thread_id — not its first message
    // (which is an agent surfacing turn, or a user reply that isn't the thread's
    // name). Correspondent label beats the first-message title; an explicit
    // rename override (below) still beats both.
    const correspondent = parseCorrespondent(session.thread_id);
    let title = correspondent ? await correspondentLabel(correspondent) : 'Conversation';
    const inDb = correspondent ? null : openReadonly(inboundDbPath(session.agent_group_id, session.id));
    if (inDb) {
      try {
        // Same channel_type scope as loadThreadHistory: title from the first
        // real web turn, never a cross-session echo or system/on_wake row.
        const row = inDb
          .prepare(
            "SELECT content FROM messages_in WHERE kind IN ('chat', 'chat-sdk') AND channel_type = ? ORDER BY seq ASC LIMIT 1",
          )
          .get(CHANNEL_TYPE) as { content: string } | undefined;
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

    base.push({
      threadId: session.thread_id,
      title,
      lastActive: toEpoch(session.last_active ?? session.created_at),
    });
  }

  const meta = await getThreadMetaFor(
    mg.id,
    base.map((b) => b.threadId),
  );
  return base.map((b) => {
    const m = meta.get(b.threadId);
    // A persisted, non-empty override wins; otherwise the first-message title.
    const override = m?.title && m.title.trim() ? m.title : null;
    return {
      threadId: b.threadId,
      title: override ?? b.title,
      lastActive: b.lastActive,
      pinned: m?.pinned ?? false,
      archived: !!m?.archived_at,
    };
  });
}

function stripArchived({ archived: _archived, ...summary }: EnrichedThread): ThreadSummary {
  return summary;
}

/**
 * The active web thread list: one entry per per-thread session that is NOT
 * archived, newest first, titled by its override or first user message.
 */
export async function listThreads(platformId: string): Promise<ThreadSummary[]> {
  const list = (await enrichedThreads(platformId)).filter((t) => !t.archived);
  list.sort((a, b) => b.lastActive - a.lastActive);
  return list.map(stripArchived);
}

/**
 * The archived web thread list (calcifer-3236 / B0), newest first. `query`
 * filters by a case-insensitive substring of the (possibly overridden) title —
 * the archive-browser search (B3).
 */
export async function listArchivedThreads(platformId: string, query?: string): Promise<ThreadSummary[]> {
  let list = (await enrichedThreads(platformId)).filter((t) => t.archived);
  const q = query?.trim().toLowerCase();
  if (q) list = list.filter((t) => t.title.toLowerCase().includes(q));
  list.sort((a, b) => b.lastActive - a.lastActive);
  return list.map(stripArchived);
}

/** The web messaging group id for a platformId, or null if unknown. */
async function webMessagingGroupId(platformId: string): Promise<string | null> {
  const mg = await getMessagingGroupByPlatform(CHANNEL_TYPE, platformId);
  return mg?.id ?? null;
}

/**
 * Rename a web conversation (calcifer-3236 / B0). An empty/whitespace title
 * clears the override, falling back to the first-message title. Returns false
 * if the platformId maps to no known web messaging group.
 */
export async function renameWebThread(platformId: string, threadId: string, title: string | null): Promise<boolean> {
  const mgId = await webMessagingGroupId(platformId);
  if (!mgId) return false;
  await setThreadTitle(mgId, threadId, title && title.trim() ? title.trim() : null);
  return true;
}

/**
 * Archive (archived=true) or rescue (archived=false) a web conversation
 * (calcifer-3236 / B0). Returns false if the platformId maps to no known web
 * messaging group.
 */
export async function setWebThreadArchived(platformId: string, threadId: string, archived: boolean): Promise<boolean> {
  const mgId = await webMessagingGroupId(platformId);
  if (!mgId) return false;
  await setThreadArchived(mgId, threadId, archived);
  return true;
}

/**
 * Pin (pinned=true) or unpin a web conversation (calcifer-3d5f / B5). Pinned
 * threads float to the top of the active list regardless of last-active time.
 * Returns false if the platformId maps to no known web messaging group.
 */
export async function setWebThreadPinned(platformId: string, threadId: string, pinned: boolean): Promise<boolean> {
  const mgId = await webMessagingGroupId(platformId);
  if (!mgId) return false;
  await setThreadPinned(mgId, threadId, pinned);
  return true;
}
