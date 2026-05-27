/**
 * v1-parity tests for formatter behavior.
 *
 * Port of src/v1/formatting.test.ts (at commit 27c5220, parent of the v1
 * deletion commit 86becf8). Covers: context timezone header, reply_to +
 * quoted_message rendering, XML escaping, and stripInternalTags.
 *
 * Timestamp-format assertions use `formatLocalTime()` output format, which
 * is host locale-dependent for decorators (month abbr, "," separator) but
 * stable for the numeric parts we assert on (hour, minute, year).
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import { initTestSessionDb, closeSessionDb, getInboundDb } from './db/connection.js';
import { getPendingMessages } from './db/messages-in.js';
import { formatMessages, stripInternalTags } from './formatter.js';
import { TIMEZONE } from './timezone.js';

beforeEach(() => {
  initTestSessionDb();
});

afterEach(() => {
  closeSessionDb();
});

function insertMessage(id: string, kind: string, content: object, opts?: { timestamp?: string; trigger?: number }) {
  const timestamp = opts?.timestamp ?? new Date().toISOString();
  const trigger = opts?.trigger ?? 1;
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, kind, timestamp, status, trigger, content)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
    )
    .run(id, kind, timestamp, trigger, JSON.stringify(content));
}

describe('context timezone header', () => {
  it('prepends <context timezone="..."/> to formatted output', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'hello' });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain(`<context timezone="${TIMEZONE}"`);
  });

  it('includes the header even when the message list is empty', () => {
    const result = formatMessages([]);
    expect(result).toContain(`<context timezone="${TIMEZONE}"`);
  });

  it('header comes before the first <message> block when multiple are present', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'one' });
    insertMessage('m2', 'chat', { sender: 'Bob', text: 'two' });
    const result = formatMessages(getPendingMessages());
    const ctxIdx = result.indexOf('<context');
    const firstMsgIdx = result.indexOf('<message ');
    expect(ctxIdx).toBeGreaterThanOrEqual(0);
    expect(firstMsgIdx).toBeGreaterThan(ctxIdx);
  });
});

describe('multi-message chat batches', () => {
  // Regression guard for #2555: an outer `<messages>` envelope around
  // multiple chat messages caused the Claude Agent SDK to emit a synthetic
  // `No response requested.` stub instead of calling the API. Each
  // `<message>` block is self-contained; concatenating them is enough.
  it('does NOT wrap multiple chat messages in an outer <messages> envelope', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'one' });
    insertMessage('m2', 'chat', { sender: 'Bob', text: 'two' });
    const result = formatMessages(getPendingMessages());
    expect(result).not.toContain('<messages>');
    expect(result).not.toContain('</messages>');
  });

  it('emits one <message> block per inbound row, in order', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'first' });
    insertMessage('m2', 'chat', { sender: 'Bob', text: 'second' });
    insertMessage('m3', 'chat', { sender: 'Carol', text: 'third' });
    const result = formatMessages(getPendingMessages());
    const matches = result.match(/<message [^>]*>/g) ?? [];
    expect(matches.length).toBe(3);
    const firstIdx = result.indexOf('first');
    const secondIdx = result.indexOf('second');
    const thirdIdx = result.indexOf('third');
    expect(firstIdx).toBeGreaterThan(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
    expect(thirdIdx).toBeGreaterThan(secondIdx);
  });
});

describe('timestamp formatting', () => {
  it('renders time via formatLocalTime (user TZ)', () => {
    // 2026-06-15T12:00:00Z — timezone-agnostic assertions (year is stable)
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'hi' }, { timestamp: '2026-06-15T12:00:00.000Z' });
    const result = formatMessages(getPendingMessages());
    // formatLocalTime's format in en-US contains the year and a month abbrev
    expect(result).toContain('2026');
    expect(result).toMatch(/Jun/);
  });

  it('uses 12-hour AM/PM format', () => {
    // 15:30 UTC — some hour will show with AM or PM depending on TZ
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'hi' }, { timestamp: '2026-06-15T15:30:00.000Z' });
    const result = formatMessages(getPendingMessages());
    expect(result).toMatch(/(AM|PM)/);
  });
});

describe('reply_to + quoted_message rendering', () => {
  it('renders reply_to attribute and quoted_message when all fields present', () => {
    insertMessage('m1', 'chat', {
      sender: 'Alice',
      text: 'Yes, on my way!',
      replyTo: { id: '42', sender: 'Bob', text: 'Are you coming tonight?' },
    });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('reply_to="42"');
    expect(result).toContain('<quoted_message from="Bob">Are you coming tonight?</quoted_message>');
    expect(result).toContain('Yes, on my way!</message>');
  });

  it('omits reply_to and quoted_message when no reply context', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'plain' });
    const result = formatMessages(getPendingMessages());
    expect(result).not.toContain('reply_to');
    expect(result).not.toContain('quoted_message');
  });

  it('renders reply_to but omits quoted_message when original content is missing', () => {
    insertMessage('m1', 'chat', {
      sender: 'Alice',
      text: 'ack',
      replyTo: { id: '42', sender: 'Bob' }, // no text
    });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('reply_to="42"');
    expect(result).not.toContain('quoted_message');
  });

  it('XML-escapes reply context', () => {
    insertMessage('m1', 'chat', {
      sender: 'Alice',
      text: 'reply',
      replyTo: { id: '1', sender: 'A & B', text: '<script>alert("xss")</script>' },
    });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('from="A &amp; B"');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&quot;xss&quot;');
  });
});

describe('XML escaping', () => {
  it('escapes <, >, &, " in sender and body', () => {
    insertMessage('m1', 'chat', {
      sender: 'A & B <Co>',
      text: '<script>alert("xss")</script>',
    });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('sender="A &amp; B &lt;Co&gt;"');
    expect(result).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});

describe('stripInternalTags', () => {
  it('strips single-line internal tags and trims', () => {
    expect(stripInternalTags('hello <internal>secret</internal> world')).toBe('hello  world');
  });

  it('strips multi-line internal tags', () => {
    expect(stripInternalTags('hello <internal>\nsecret\nstuff\n</internal> world')).toBe('hello  world');
  });

  it('strips multiple internal tag blocks', () => {
    expect(stripInternalTags('<internal>a</internal>hello<internal>b</internal>')).toBe('hello');
  });

  it('returns empty string when input is only internal tags', () => {
    expect(stripInternalTags('<internal>only this</internal>')).toBe('');
  });

  it('returns input unchanged when there are no internal tags', () => {
    expect(stripInternalTags('hello world')).toBe('hello world');
  });

  it('preserves content that surrounds internal tags', () => {
    expect(stripInternalTags('<internal>thinking</internal>The answer is 42')).toBe('The answer is 42');
  });
});

describe('senderName preferred over sender JID', () => {
  it('uses senderName when present instead of raw sender JID', () => {
    insertMessage('m1', 'chat', { sender: '14045426258@s.whatsapp.net', senderName: 'Joel', text: 'hi' });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('sender="Joel"');
    expect(result).not.toContain('14045426258@s.whatsapp.net');
  });

  it('falls back to sender when senderName is absent', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'hi' });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('sender="Alice"');
  });

  it('falls back to sender when senderName is empty string', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', senderName: '', text: 'hi' });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('sender="Alice"');
  });
});

describe('group_context: trigger=0 accumulation (#2436)', () => {
  // Regression guard: trigger=0 rows are accumulated ambient group chat
  // (ignored_message_policy='accumulate'). When they ride along with a
  // trigger=1 @mention, the formatter must present them as context the agent
  // should NOT respond to, while trigger=1 rows stay as normal <message> blocks.

  it('wraps trigger=0 messages in <group_context>', () => {
    insertMessage('ctx1', 'chat', { sender: 'Alice', text: 'hey anyone around?' }, { trigger: 0 });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('<group_context');
    expect(result).toContain('ambient conversation');
    expect(result).toContain('hey anyone around?');
  });

  it('trigger=1 messages remain as plain <message> blocks (no group_context wrapper)', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'hello' });
    const result = formatMessages(getPendingMessages());
    expect(result).not.toContain('<group_context');
    expect(result).toContain('<message ');
  });

  it('group_context appears before trigger=1 messages in the output', () => {
    insertMessage('ctx1', 'chat', { sender: 'Alice', text: 'ambient chat' }, { trigger: 0 });
    insertMessage('m1', 'chat', { sender: 'Alice', text: '@Calcifer help' });
    const result = formatMessages(getPendingMessages());
    const ctxIdx = result.indexOf('<group_context');
    const msgIdx = result.indexOf('<message ');
    expect(ctxIdx).toBeGreaterThanOrEqual(0);
    expect(msgIdx).toBeGreaterThan(ctxIdx);
  });

  it('multiple trigger=0 messages are all inside the group_context block', () => {
    insertMessage('ctx1', 'chat', { sender: 'Alice', text: 'msg one' }, { trigger: 0 });
    insertMessage('ctx2', 'chat', { sender: 'Bob', text: 'msg two' }, { trigger: 0 });
    insertMessage('m1', 'chat', { sender: 'Alice', text: '@Calcifer help' });
    const result = formatMessages(getPendingMessages());
    const openTag = result.indexOf('<group_context');
    const closeTag = result.indexOf('</group_context>');
    expect(openTag).toBeGreaterThanOrEqual(0);
    expect(closeTag).toBeGreaterThan(openTag);
    // Both context messages must be inside the block
    const ctxBlock = result.slice(openTag, closeTag);
    expect(ctxBlock).toContain('msg one');
    expect(ctxBlock).toContain('msg two');
    // The @mention must be outside it
    const afterBlock = result.slice(closeTag);
    expect(afterBlock).toContain('@Calcifer help');
  });

  it('trigger=0 messages inside group_context are in chronological order', () => {
    const t1 = '2026-06-01T10:00:00.000Z';
    const t2 = '2026-06-01T10:01:00.000Z';
    insertMessage('ctx1', 'chat', { sender: 'Alice', text: 'first' }, { trigger: 0, timestamp: t1 });
    insertMessage('ctx2', 'chat', { sender: 'Bob', text: 'second' }, { trigger: 0, timestamp: t2 });
    insertMessage('m1', 'chat', { sender: 'Alice', text: '@Calcifer go' });
    const result = formatMessages(getPendingMessages());
    const firstIdx = result.indexOf('first');
    const secondIdx = result.indexOf('second');
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it('all-trigger=0 batch is wrapped entirely in group_context (degenerate case)', () => {
    // In normal operation the poll-loop gate prevents all-trigger=0 batches
    // from reaching the formatter, but the formatter must handle it gracefully.
    insertMessage('ctx1', 'chat', { sender: 'Alice', text: 'just chatting' }, { trigger: 0 });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('<group_context');
    expect(result).toContain('</group_context>');
    // No bare <message> block outside group_context
    const closeTag = result.indexOf('</group_context>');
    const afterBlock = result.slice(closeTag + '</group_context>'.length);
    expect(afterBlock).not.toMatch(/<message /);
  });
});
