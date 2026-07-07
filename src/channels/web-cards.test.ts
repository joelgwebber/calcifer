import { describe, it, expect } from 'vitest';

import { normalizeCard } from './web-cards.js';

describe('normalizeCard', () => {
  it('normalizes title, description, string + {text} children', () => {
    const card = normalizeCard({
      type: 'card',
      card: {
        title: 'Hi',
        description: 'A card',
        children: ['line one', { text: 'line two' }, '', { nope: 1 }],
      },
      fallbackText: 'Hi — A card',
    });
    expect(card).toEqual({
      title: 'Hi',
      description: 'A card',
      children: ['line one', 'line two'],
      fallbackText: 'Hi — A card',
    });
  });

  it('accepts a `url` action', () => {
    const card = normalizeCard({
      type: 'card',
      card: { title: 'T', actions: [{ label: 'Open', url: 'https://example.com', style: 'primary' }] },
    });
    expect(card?.actions).toEqual([{ label: 'Open', url: 'https://example.com', style: 'primary' }]);
  });

  it('accepts an `href` action (the shape the agent emits in practice)', () => {
    const card = normalizeCard({
      type: 'card',
      card: { title: 'T', actions: [{ type: 'url', label: 'Open StreetEasy', href: 'https://streeteasy.com' }] },
    });
    expect(card?.actions).toEqual([{ label: 'Open StreetEasy', url: 'https://streeteasy.com', style: undefined }]);
  });

  it('drops actions with neither url nor href (fire-and-forget: nowhere to land)', () => {
    const card = normalizeCard({
      type: 'card',
      card: { title: 'T', actions: [{ label: 'Confirm', value: 'yes' }] },
    });
    expect(card).toEqual({ title: 'T' });
  });

  it('coerces an unknown style to undefined', () => {
    const card = normalizeCard({
      type: 'card',
      card: { title: 'T', actions: [{ label: 'Go', url: 'https://x.io', style: 'wild' }] },
    });
    expect(card?.actions?.[0].style).toBeUndefined();
  });

  it('returns null for interactive ask_question payloads (out of scope; 7c3a.5)', () => {
    expect(normalizeCard({ type: 'ask_question', card: { title: 'Pick' } })).toBeNull();
  });

  it('returns null for plain text content, non-objects, and empty cards', () => {
    expect(normalizeCard({ text: 'just text' })).toBeNull();
    expect(normalizeCard('a string')).toBeNull();
    expect(normalizeCard(null)).toBeNull();
    expect(normalizeCard({ type: 'card', card: {} })).toBeNull();
  });
});
