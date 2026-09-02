import { describe, expect, it } from 'vitest';

import { parseCorrespondent, peerThreadId, systemThreadId } from './correspondent.js';

describe('correspondent grammar', () => {
  it('peerThreadId / systemThreadId round-trip through parseCorrespondent', () => {
    expect(parseCorrespondent(peerThreadId('ag-joel'))).toEqual({ kind: 'agent', ref: 'ag-joel' });
    expect(parseCorrespondent(systemThreadId('reminders'))).toEqual({ kind: 'system', ref: 'reminders' });
  });

  it('ordinary user chat thread_ids have no correspondent', () => {
    expect(parseCorrespondent('f57dc81f-c2e8-4f91-bb28-9006866b53c0')).toBeNull();
    expect(parseCorrespondent('web-in-123')).toBeNull();
    expect(parseCorrespondent(null)).toBeNull();
    expect(parseCorrespondent(undefined)).toBeNull();
    expect(parseCorrespondent('')).toBeNull();
  });

  it('a bare prefix with no ref is not a correspondent', () => {
    expect(parseCorrespondent('peer:')).toBeNull();
    expect(parseCorrespondent('sys:')).toBeNull();
  });

  it('does not collide with task threads (system:tasks:*)', () => {
    // Task threads use the `system:` prefix, not `sys:` — never misparsed.
    expect(parseCorrespondent('system:tasks:daily-brief')).toBeNull();
  });

  it('preserves a ref that itself contains colons', () => {
    expect(parseCorrespondent('peer:ag-1777141351652-tx7j2h')).toEqual({
      kind: 'agent',
      ref: 'ag-1777141351652-tx7j2h',
    });
  });
});
