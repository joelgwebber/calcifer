import { useStore } from './store';
import { uuid } from './uuid';

/**
 * Send a user message to a thread: optimistic append + running flag + POST
 * /api/send. The assistant reply arrives asynchronously over SSE (nanoclaw is
 * async/push), NOT in this response.
 *
 * The optimistic append and running flag are set synchronously before the
 * network call, so a caller can `void sendUserMessage(...)` and immediately
 * navigate — the chat will already show the pending turn.
 *
 * Shared by the chat composer (runtime.tsx onNew) and the views' `ask` action
 * (calcifer-1d51.6), so both drive the exact same send path.
 */
export async function sendUserMessage(threadId: string, text: string): Promise<void> {
  const state = useStore.getState();
  state.appendMessage(threadId, { id: uuid(), role: 'user', text, createdAt: Date.now() });
  state.setRunning(threadId, true);
  await fetch('/api/send', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, text }),
  });
}
