import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { closeSessionDb, getInboundDb, initTestSessionDb } from './mailbox/sqlite/connection.js';
import { buildSystemPromptAddendum } from './destinations.js';

beforeEach(() => {
  initTestSessionDb();
});

afterEach(() => {
  closeSessionDb();
});

function seedDestination(name: string, displayName: string, channelType: string, platformId: string): void {
  getInboundDb()
    .prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES (?, ?, 'channel', ?, ?, NULL)`,
    )
    .run(name, displayName, channelType, platformId);
}

describe('buildSystemPromptAddendum — multi-destination routing guidance', () => {
  it('includes default-routing nudge when there are >1 destinations', () => {
    seedDestination('casa', 'Casa', 'whatsapp', 'group-1@g.us');
    seedDestination('whatsapp-mg-17780', 'whatsapp-mg-17780', 'whatsapp', 'phone-2@s.whatsapp.net');

    const prompt = buildSystemPromptAddendum('Casa');

    expect(prompt).toContain('default to addressing the destination it came `from`');
    expect(prompt).toContain('from="name"');
    expect(prompt).toContain('`casa`');
    expect(prompt).toContain('`whatsapp-mg-17780`');
  });

  it('describes message wrapping for a single destination', () => {
    seedDestination('casa', 'Casa', 'whatsapp', 'group-1@g.us');

    const prompt = buildSystemPromptAddendum('Casa');

    expect(prompt).toContain('Wrap each delivered message');
    expect(prompt).toContain('<message to="name">');
    expect(prompt).toContain('`casa`');
  });

  it('handles the no-destination case without crashing', () => {
    const prompt = buildSystemPromptAddendum('Casa');

    expect(prompt).toContain('no configured destinations');
    expect(prompt).not.toContain('default to addressing');
  });

  it('includes default-routing and wrapping instructions for single destination', () => {
    seedDestination('casa', 'Casa', 'whatsapp', 'group-1@g.us');

    const prompt = buildSystemPromptAddendum('Casa');

    expect(prompt).toContain('Wrap each delivered message');
    expect(prompt).toContain('<message to="name">');
    expect(prompt).toContain('default to addressing the destination it came `from`');
    expect(prompt).toContain('`casa`');
  });

  it('gives task sessions only explicit-tool delivery instructions', () => {
    seedDestination('casa', 'Casa', 'whatsapp', 'group-1@g.us');

    const prompt = buildSystemPromptAddendum('Casa', { kind: 'task', taskId: 'daily-briefing-a25c' });

    expect(prompt).toContain('isolated task run');
    expect(prompt).toContain('send_message({ to: "name"');
    expect(prompt).toContain('tasks/daily-briefing-a25c.md');
    expect(prompt).toContain('Only notify someone when the task asks');
    expect(prompt).not.toContain('<message to=');
    expect(prompt).not.toContain('default to addressing');
  });
});

function seedAgentDestination(name: string, displayName: string, agentGroupId: string): void {
  getInboundDb()
    .prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES (?, ?, 'agent', NULL, NULL, ?)`,
    )
    .run(name, displayName, agentGroupId);
}

function setThreadId(threadId: string): void {
  const db = getInboundDb();
  // The host writes session_routing live on each wake; the test session DB
  // doesn't ship it, so create it here (getSessionRouting tolerates absence).
  db.exec(
    `CREATE TABLE IF NOT EXISTS session_routing (id INTEGER PRIMARY KEY, channel_type TEXT, platform_id TEXT, thread_id TEXT)`,
  );
  db.prepare(`INSERT OR REPLACE INTO session_routing (id, channel_type, platform_id, thread_id) VALUES (1, ?, ?, ?)`).run(
    'web',
    'web:anais',
    threadId,
  );
}

// calcifer-2279: a standing per-correspondent thread (peer:<ag>) tells the agent
// which peer to relay a reply back to.
describe('buildSystemPromptAddendum — correspondent thread (calcifer-2279)', () => {
  it('names the peer to relay to when the session is a peer:<ag> thread', () => {
    seedAgentDestination('joel', 'Joel', 'ag-joel');
    setThreadId('peer:ag-joel');

    const prompt = buildSystemPromptAddendum('Calcifer');

    expect(prompt).toContain('This is a correspondent thread');
    expect(prompt).toContain('`joel` (Joel)');
    expect(prompt).toContain('<message to="joel">');
  });

  it('adds no correspondent note for an ordinary web chat thread', () => {
    seedAgentDestination('joel', 'Joel', 'ag-joel');
    setThreadId('f57dc81f-c2e8-4f91-bb28-9006866b53c0');

    const prompt = buildSystemPromptAddendum('Calcifer');

    expect(prompt).not.toContain('This is a correspondent thread');
  });

  it('skips the note when the peer thread has no matching agent destination', () => {
    // peer:<ag> thread but no destination targets that agent group.
    setThreadId('peer:ag-unknown');

    const prompt = buildSystemPromptAddendum('Calcifer');

    expect(prompt).not.toContain('This is a correspondent thread');
  });
});
