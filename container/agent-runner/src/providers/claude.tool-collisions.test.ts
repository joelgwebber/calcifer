import { describe, it, expect } from 'bun:test';

import { SDK_DISALLOWED_TOOLS, TOOL_ALLOWLIST } from './claude.js';

// Built-in Claude Code tools whose NAME reads as the obvious way to do
// something NanoClaw already models differently. Leaving one of these
// available is a silent failure: the agent calls the built-in, gets a
// coherent-sounding refusal about a subsystem NanoClaw doesn't use, and
// reports that NanoClaw is broken.
//
// SendMessage is the regression this guards. It addresses Claude Code's own
// in-session subagents; an agent that had just created a NanoClaw agent group
// called it four times and read "No agent named 'growth' is currently
// addressable" as "the group was never provisioned".
const COLLIDES_WITH_NANOCLAW_MCP: Array<[builtin: string, mcpEquivalent: string]> = [
  ['SendMessage', 'mcp__nanoclaw__send_message'],
  ['AskUserQuestion', 'mcp__nanoclaw__ask_user_question'],
];

describe('built-in tools that collide with NanoClaw MCP tools', () => {
  for (const [builtin, mcpEquivalent] of COLLIDES_WITH_NANOCLAW_MCP) {
    it(`${builtin} is disallowed in favour of ${mcpEquivalent}`, () => {
      expect(SDK_DISALLOWED_TOOLS).toContain(builtin);
      expect(TOOL_ALLOWLIST).not.toContain(builtin);
    });
  }

  it('no tool is both allowlisted and disallowed', () => {
    const overlap = TOOL_ALLOWLIST.filter((t) => SDK_DISALLOWED_TOOLS.includes(t));
    expect(overlap).toEqual([]);
  });
});

// calcifer-a9d9 / calcifer-11b1: fastmail-native's compose_event is an MCP-UI
// widget tool with no headless host surface — it silently stages-but-never-
// commits and renders no card here. Hard-blocked so the agent uses the direct
// create_event/update_event instead.
describe('MCP-UI tools with no headless surface are disallowed', () => {
  it('blocks fastmail-native compose_event but not the rest of the namespace', () => {
    expect(SDK_DISALLOWED_TOOLS).toContain('mcp__fastmail-native__compose_event');
    // A specific-tool block, not a whole-server block: create_event/search_events
    // and the email tools stay reachable via the mcp__fastmail-native__* allow.
    expect(SDK_DISALLOWED_TOOLS).not.toContain('mcp__fastmail-native__create_event');
  });
});
