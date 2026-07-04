import { useEffect, type ReactNode } from 'react';
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
  type ExternalStoreThreadListAdapter,
} from '@assistant-ui/react';
import { useStore, type MyMessage, PLATFORM_ID } from './store';
import { uuid } from './uuid';

const convertMessage = (m: MyMessage): ThreadMessageLike => ({
  role: m.role,
  content: [{ type: 'text', text: m.text }],
  id: m.id,
  createdAt: new Date(m.createdAt),
});

/** SSE payload shapes emitted by the host. */
type MessageEventPayload = {
  threadId: string | null;
  message: {
    id: string;
    role: 'assistant';
    text: string;
    createdAt: string;
  };
};

type TypingEventPayload = {
  threadId: string | null;
};

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const currentThreadId = useStore((s) => s.currentThreadId);
  const messages = useStore((s) => s.messages[s.currentThreadId] ?? []);
  const isRunning = useStore((s) => s.running[s.currentThreadId] ?? false);
  const threadIds = useStore((s) => s.threadIds);
  const titles = useStore((s) => s.titles);

  const onNew = async (message: AppendMessage) => {
    const state = useStore.getState();
    const threadId = state.currentThreadId;
    const text = message.content.find((p) => p.type === 'text')?.text ?? '';

    state.appendMessage(threadId, {
      id: uuid(),
      role: 'user',
      text,
      createdAt: Date.now(),
    });
    state.setRunning(threadId, true);

    // Fire-and-forget: the assistant reply arrives asynchronously over SSE,
    // NOT in this response. nanoclaw is async/push.
    await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platformId: PLATFORM_ID, threadId, text }),
    });
  };

  const threadList: ExternalStoreThreadListAdapter = {
    threadId: currentThreadId,
    threads: threadIds.map((id) => ({
      id,
      title: titles[id],
      status: 'regular' as const,
    })),
    archivedThreads: [],
    onSwitchToNewThread: () => {
      useStore.getState().createThread();
    },
    onSwitchToThread: (id) => {
      useStore.getState().setCurrentThreadId(id);
    },
    onRename: (id, title) => {
      useStore.getState().renameThread(id, title);
    },
    onDelete: (id) => {
      useStore.getState().deleteThread(id);
    },
  };

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    convertMessage,
    onNew,
    adapters: { threadList },
  });

  // Open a single SSE connection for the lifetime of the app.
  useEffect(() => {
    const source = new EventSource(`/api/stream?platformId=${encodeURIComponent(PLATFORM_ID)}`);

    const onMessage = (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as MessageEventPayload;
      const state = useStore.getState();
      // Fall back to the current thread when the host omits a threadId.
      const threadId = payload.threadId ?? state.currentThreadId;
      state.ensureThread(threadId);
      state.appendMessage(threadId, {
        id: payload.message.id,
        role: 'assistant',
        text: payload.message.text,
        createdAt: Date.parse(payload.message.createdAt),
      });
      state.setRunning(threadId, false);
    };

    const onTyping = (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as TypingEventPayload;
      const state = useStore.getState();
      const threadId = payload.threadId ?? state.currentThreadId;
      state.ensureThread(threadId);
      state.setRunning(threadId, true);
    };

    source.addEventListener('message', onMessage);
    source.addEventListener('typing', onTyping);
    // "ready" is informational; no handler needed beyond the open connection.

    return () => {
      source.removeEventListener('message', onMessage);
      source.removeEventListener('typing', onTyping);
      source.close();
    };
  }, []);

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
