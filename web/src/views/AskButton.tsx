import { type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { sendUserMessage } from '../send';
import { interpolate } from './primitives';
import type { Row } from './types';

/**
 * The `ask` view action (calcifer-1d51.6): the escape valve from the direct
 * data plane back to the agent. Interpolates the manifest `prompt` against the
 * record, opens a FRESH chat thread (its own session/container context), fires
 * the message, and navigates to the chat so the user sees the turn begin.
 *
 * The send is fire-and-forget: sendUserMessage appends the optimistic user turn
 * synchronously before its network call, so by the time we navigate the chat
 * already shows the pending message + running state.
 */
export function AskButton({ label, prompt, row }: { label?: string; prompt?: string; row: Row }) {
  const navigate = useNavigate();
  const text = prompt ? interpolate(prompt, row) : '';
  if (!text) return null;

  function onClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation(); // don't trigger the card's record link
    const threadId = useStore.getState().createThread();
    void sendUserMessage(threadId, text);
    navigate('/');
  }

  return (
    <button className="icon-button" onClick={onClick}>
      {label ?? 'Ask'}
    </button>
  );
}
