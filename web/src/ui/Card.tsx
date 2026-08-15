import { useState } from 'react';
import { Link } from 'react-router-dom';
import { setAnnotation } from '../views/api';
import type { Card } from '../store';

/**
 * Renders a `send_card` payload as an inline generative-UI message part
 * (calcifer-7c3a.4). Registered as the `card` tool UI in Thread.tsx, so it
 * receives the normalized card as the tool-call `args`.
 *
 * Two flavours share this component:
 *  - hand-authored cards (title/body/lines + URL buttons), and
 *  - record cards (calcifer-2588): a live projection of a view record, with a
 *    thumbnail, subtitle/badges, an interactive star, and an Open deep-link —
 *    the same record you'd see in the list, hoisted into the conversation.
 */
export function CardMessagePart({ args }: { args: Card }) {
  const card = args ?? {};
  return card.record ? <RecordCard card={card} /> : <PlainCard card={card} />;
}

function RecordCard({ card }: { card: Card }) {
  const rec = card.record!;
  const [starred, setStarred] = useState(rec.starred);
  const [busy, setBusy] = useState(false);

  async function toggleStar() {
    if (busy) return;
    const next = !starred;
    setStarred(next); // optimistic
    setBusy(true);
    try {
      await setAnnotation(rec.view, rec.id, 'star', next ? 'true' : null);
    } catch {
      setStarred(!next); // revert
    } finally {
      setBusy(false);
    }
  }

  const openTo = `/app/${rec.view}/${encodeURIComponent(rec.id)}`;

  return (
    <div className="chat-card chat-record-card">
      {rec.thumbnail && (
        <Link className="chat-record-thumb" to={openTo}>
          <img src={rec.thumbnail} alt={card.title ?? ''} loading="lazy" />
        </Link>
      )}
      <div className="chat-record-main">
        <Link className="chat-record-title" to={openTo}>
          {card.title ?? rec.id}
        </Link>
        {rec.subtitle && <div className="chat-card-body">{rec.subtitle}</div>}
        {rec.badges && rec.badges.length > 0 && (
          <div className="card-badges">
            {rec.badges.map((b, i) => (
              <span className="v-badge" key={i}>
                {b}
              </span>
            ))}
          </div>
        )}
        <div className="chat-card-actions">
          <button className={`chat-card-action chat-record-star ${starred ? 'starred' : ''}`} onClick={toggleStar}>
            {starred ? '★ Starred' : '☆ Star'}
          </button>
          <Link className="chat-card-action chat-card-action-primary" to={openTo}>
            Open
          </Link>
        </div>
      </div>
    </div>
  );
}

function PlainCard({ card }: { card: Card }) {
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
          {card.actions!.map((a, i) => {
            const cls = `chat-card-action chat-card-action-${a.style ?? 'default'}`;
            // In-app view links (/app/<view>/<id>) route via react-router so a card
            // is a live projection of a view record (calcifer-1d51.6); everything
            // else opens externally in a new tab.
            return a.url.startsWith('/') ? (
              <Link key={i} className={cls} to={a.url}>
                {a.label}
              </Link>
            ) : (
              <a key={i} className={cls} href={a.url} target="_blank" rel="noopener noreferrer">
                {a.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
