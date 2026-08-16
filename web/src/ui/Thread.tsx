import { ThreadPrimitive, MessagePrimitive, ComposerPrimitive } from '@assistant-ui/react';
import { CardMessagePart } from './Card';
import { QuestionMessagePart } from './Question';
import { useStore } from '../store';

export function Thread() {
  return (
    <ThreadPrimitive.Root className="thread">
      <ThreadPrimitive.Viewport className="thread-viewport">
        <ThreadPrimitive.Empty>
          <div className="thread-empty">Start the conversation…</div>
        </ThreadPrimitive.Empty>
        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
        <ActivityIndicator />
      </ThreadPrimitive.Viewport>

      <ComposerPrimitive.Root className="composer">
        <ComposerPrimitive.Input className="composer-input" placeholder="Message nanoclaw…" autoFocus />
        <ComposerPrimitive.Send className="composer-send">Send</ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}

/**
 * Live "agent is working" indicator (calcifer-5b6b). Driven straight from the
 * store: visible whenever the current thread is running, showing the current
 * activity label ("Thinking…", "Reading listings.db", tool verbs) when one is
 * present, and animated dots otherwise. Replaces assistant-ui's bare single
 * dot with something that reflects what the agent is actually doing.
 */
function ActivityIndicator() {
  const running = useStore((s) => s.running[s.currentThreadId] ?? false);
  const label = useStore((s) => s.status[s.currentThreadId] ?? null);
  if (!running) return null;
  return (
    <div className="activity-indicator" aria-live="polite">
      <span className="activity-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {label ? <span className="activity-label">{label}</span> : null}
    </div>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="message message-user">
      <div className="message-bubble">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="message message-assistant">
      <div className="message-bubble">
        <MessagePrimitive.Parts
          components={{ tools: { by_name: { card: CardMessagePart, question: QuestionMessagePart } } }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}
