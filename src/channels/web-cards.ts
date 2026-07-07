/**
 * Web-UI card normalization (calcifer-7c3a.4).
 *
 * The `send_card` MCP tool writes outbound rows with `kind:'chat-sdk'` and
 * content `{ type:'card', card, fallbackText }`. The Chat SDK bridge renders
 * these for Discord/Slack; this module gives the web adapter (live delivery in
 * web.ts, refresh/history in web-history.ts) a single, trusted normalizer so
 * both paths produce the identical wire shape the frontend renders.
 *
 * The normalized shape mirrors the bridge's card branch (chat-sdk-bridge.ts):
 * title + description + string children, and URL-only actions. `send_card` is
 * fire-and-forget, so non-URL (callback) actions are dropped — they'd have
 * nowhere to land. Interactive `ask_question` payloads use a different content
 * type and are intentionally NOT matched here (tracked in calcifer-7c3a.5).
 */

export interface WebCardAction {
  label: string;
  url: string;
  style?: 'primary' | 'danger' | 'default';
}

export interface WebCard {
  title?: string;
  description?: string;
  /** Flattened text lines (string children and `{ text }` children). */
  children?: string[];
  actions?: WebCardAction[];
  /** Text fallback for platforms/renderers without card support. */
  fallbackText?: string;
}

/**
 * Parse a `send_card` outbound content blob into the normalized web card, or
 * null when the content isn't a display card (text message, ask_question, etc.)
 * or is empty. `content` is the already-parsed JSON object from a messages_out
 * row (or an OutboundMessage.content).
 */
export function normalizeCard(content: unknown): WebCard | null {
  if (!content || typeof content !== 'object') return null;
  const c = content as Record<string, unknown>;
  if (c.type !== 'card' || !c.card || typeof c.card !== 'object') return null;

  const spec = c.card as Record<string, unknown>;
  const card: WebCard = {};

  if (typeof spec.title === 'string' && spec.title) card.title = spec.title;
  if (typeof spec.description === 'string' && spec.description) card.description = spec.description;

  const children: string[] = [];
  if (Array.isArray(spec.children)) {
    for (const child of spec.children) {
      if (typeof child === 'string' && child) {
        children.push(child);
      } else if (child && typeof child === 'object' && typeof (child as Record<string, unknown>).text === 'string') {
        children.push((child as Record<string, string>).text);
      }
    }
  }
  if (children.length > 0) card.children = children;

  if (Array.isArray(spec.actions)) {
    const actions: WebCardAction[] = [];
    for (const a of spec.actions as Array<Record<string, unknown>>) {
      // Accept either `url` or `href` for the link target: the send_card tool
      // doesn't pin the action shape, so the agent may emit either (it uses the
      // HTML `href` name in practice). Being liberal here avoids silently
      // dropping link buttons.
      const url = typeof a.url === 'string' && a.url ? a.url : typeof a.href === 'string' && a.href ? a.href : null;
      if (url && typeof a.label === 'string' && a.label) {
        const style = a.style;
        actions.push({
          label: a.label,
          url,
          style: style === 'primary' || style === 'danger' || style === 'default' ? style : undefined,
        });
      }
    }
    if (actions.length > 0) card.actions = actions;
  }

  const fallbackText = typeof c.fallbackText === 'string' && c.fallbackText ? c.fallbackText : undefined;
  if (fallbackText) card.fallbackText = fallbackText;

  // Nothing renderable — treat as a non-card so callers fall back to text.
  if (!card.title && !card.description && !card.children && !card.actions) return null;

  return card;
}
