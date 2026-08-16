import { describe, it, expect } from 'bun:test';

import { appLink } from './interactive.js';

function linkOf(result: unknown): string {
  const r = result as { content?: Array<{ text?: string }>; isError?: boolean };
  return r.content?.[0]?.text ?? '';
}

describe('app_link', () => {
  it('builds a relative /app/<view>/<id> deep link', async () => {
    const res = await appLink.handler({ view: 'apartments', id: 'se-5095099' });
    expect(linkOf(res)).toBe('/app/apartments/se-5095099');
  });

  it('URL-encodes path ids (slashes -> %2F) so file-backed records resolve', async () => {
    const res = await appLink.handler({
      view: 'family-wiki',
      id: 'health/legal/jay-name-change/Consent_and_Acknowledgment.md',
    });
    expect(linkOf(res)).toBe(
      '/app/family-wiki/health%2Flegal%2Fjay-name-change%2FConsent_and_Acknowledgment.md',
    );
  });

  it('errors when view or id is missing', async () => {
    const missingId = (await appLink.handler({ view: 'apartments', id: '' })) as { isError?: boolean };
    expect(missingId.isError).toBe(true);
    const missingView = (await appLink.handler({ view: '', id: 'x' })) as { isError?: boolean };
    expect(missingView.isError).toBe(true);
  });
});
