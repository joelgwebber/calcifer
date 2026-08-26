import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThreadPrimitive, MessagePrimitive, ComposerPrimitive } from '@assistant-ui/react';
import type { TextMessagePartProps } from '@assistant-ui/react';
import { CardMessagePart } from './Card';
import { QuestionMessagePart } from './Question';
import { Prose, type ProseNav } from '../views/Prose';
import { useStore } from '../store';
import { useNav } from './layout';

/**
 * Render a text message part as markdown (calcifer-d1f8). Reuses the
 * source-agnostic Prose primitive (react-markdown + remark-gfm) so chat
 * bubbles get headings, lists, tables, code blocks, and links instead of raw
 * text — the same renderer the wiki/doc views use. Raw HTML stays inert
 * (Prose has no rehype-raw), so agent- or user-authored text can't inject markup.
 */
function MarkdownText({ text }: TextMessagePartProps) {
  const navigate = useNavigate();
  // Internal app links (/app/<view>/<id>, and any in-app path) route in the
  // same window via the SPA — matching how record cards open (calcifer-1276).
  // External links fall through to Prose's new-tab branch.
  const nav = useMemo<ProseNav>(
    () => ({
      onNavigate: (href) => {
        if (href.startsWith('/')) {
          navigate(href);
          return true;
        }
        return false;
      },
    }),
    [navigate],
  );
  return <Prose markdown={text} nav={nav} />;
}

export function Thread() {
  // Yield autofocus to the mobile nav drawer while it's open — otherwise the
  // composer's autoFocus fights the drawer's focus-trap for the input (A3).
  const drawerOpen = useNav((s) => s.drawerOpen);
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
        <ComposerPrimitive.Input className="composer-input" placeholder="Message hearth…" autoFocus={!drawerOpen} />
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
        <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="message message-assistant">
      <div className="message-bubble">
        <MessagePrimitive.Parts
          components={{ Text: MarkdownText, tools: { by_name: { card: CardMessagePart, question: QuestionMessagePart } } }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}
