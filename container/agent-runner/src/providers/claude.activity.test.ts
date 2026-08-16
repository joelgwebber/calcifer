import { describe, it, expect } from 'bun:test';

import { describeAssistantActivity } from './claude.js';

describe('describeAssistantActivity', () => {
  it('returns null for non-array / empty content', () => {
    expect(describeAssistantActivity(undefined)).toBeNull();
    expect(describeAssistantActivity(null)).toBeNull();
    expect(describeAssistantActivity('nope')).toBeNull();
    expect(describeAssistantActivity([])).toBeNull();
  });

  it('labels file tools with the basename only', () => {
    expect(
      describeAssistantActivity([{ type: 'tool_use', name: 'Read', input: { file_path: '/home/joel/store/listings.db' } }]),
    ).toBe('Reading listings.db');
    expect(
      describeAssistantActivity([{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/App.tsx' } }]),
    ).toBe('Editing App.tsx');
    expect(describeAssistantActivity([{ type: 'tool_use', name: 'Write', input: {} }])).toBe('Writing a file');
  });

  it('never echoes the Bash command', () => {
    expect(
      describeAssistantActivity([{ type: 'tool_use', name: 'Bash', input: { command: 'echo $SECRET_TOKEN' } }]),
    ).toBe('Running a command');
  });

  it('surfaces web search queries but truncates long ones', () => {
    expect(
      describeAssistantActivity([{ type: 'tool_use', name: 'WebSearch', input: { query: 'no-fee 2br brooklyn' } }]),
    ).toBe('Searching the web: "no-fee 2br brooklyn"');
    const long = 'a'.repeat(100);
    const label = describeAssistantActivity([{ type: 'tool_use', name: 'WebSearch', input: { query: long } }]) as string;
    // prefix (`Searching the web: "`) + 60-char cap + `…"` ≈ 82 chars; the point
    // is the 100-char query got capped, not passed through whole.
    expect(label.length).toBeLessThan(90);
    expect(label).not.toContain(long);
    expect(label.endsWith('…"')).toBe(true);
  });

  it('shows the host for WebFetch', () => {
    expect(
      describeAssistantActivity([{ type: 'tool_use', name: 'WebFetch', input: { url: 'https://streeteasy.com/x/y' } }]),
    ).toBe('Fetching streeteasy.com');
  });

  it('humanizes MCP tool names', () => {
    expect(
      describeAssistantActivity([{ type: 'tool_use', name: 'mcp__nanoclaw__send_message', input: {} }]),
    ).toBe('Running send message');
    expect(
      describeAssistantActivity([{ type: 'tool_use', name: 'mcp__seafile__listFiles', input: {} }]),
    ).toBe('Running list files');
  });

  it('prefers a tool_use over thinking/text in the same message', () => {
    expect(
      describeAssistantActivity([
        { type: 'thinking', thinking: 'hmm' },
        { type: 'tool_use', name: 'Grep', input: {} },
        { type: 'text', text: 'ok' },
      ]),
    ).toBe('Searching code');
  });

  it('falls back to thinking, then text', () => {
    expect(describeAssistantActivity([{ type: 'thinking', thinking: 'reasoning' }])).toBe('Thinking…');
    expect(describeAssistantActivity([{ type: 'redacted_thinking' }])).toBe('Thinking…');
    expect(describeAssistantActivity([{ type: 'text', text: 'here is my answer' }])).toBe('Responding…');
    expect(describeAssistantActivity([{ type: 'text', text: '   ' }])).toBeNull();
  });
});
