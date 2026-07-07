import type { Card } from '../store';

/**
 * Renders a `send_card` payload as an inline generative-UI message part
 * (calcifer-7c3a.4). Registered as the `card` tool UI in Thread.tsx, so it
 * receives the normalized card as the tool-call `args`.
 *
 * Kept intentionally declarative and trusted: title, body/description, plain
 * text lines, and URL-only link buttons — mirroring the host normalizer and
 * the Chat SDK bridge's card branch so every surface renders consistently.
 */
export function CardMessagePart({ args }: { args: Card }) {
  const card = args ?? {};
  const hasActions = !!card.actions && card.actions.length > 0;

  return (
    <div className="chat-card">
      {card.title && <div className="chat-card-title">{card.title}</div>}
      {card.description && <div className="chat-card-body">{card.description}</div>}
      {card.children?.map((line, i) => (
        <div key={i} className="chat-card-line">
          {line}
        </div>
      ))}
      {hasActions && (
        <div className="chat-card-actions">
          {card.actions!.map((a, i) => (
            <a
              key={i}
              className={`chat-card-action chat-card-action-${a.style ?? 'default'}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {a.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
