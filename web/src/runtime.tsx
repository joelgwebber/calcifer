import { useEffect, type ReactNode } from 'react';
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
  type ExternalStoreThreadListAdapter,
} from '@assistant-ui/react';
import { useStore, type MyMessage } from './store';
import { sendUserMessage } from './send';

const convertMessage = (m: MyMessage): ThreadMessageLike => {
  // Cards and interactive prompts render as generative-UI tool-call parts
  // (rendered by the `card` / `question` tool UIs in Thread.tsx). `result` MUST
  // be defined: assistant-ui treats a tool-call part with `result === undefined`
  // as still-running.
  if (m.question) {
    return {
      role: m.role,
      content: [{ type: 'tool-call', toolCallId: m.id, toolName: 'question', args: m.question, result: {} }],
      id: m.id,
      createdAt: new Date(m.createdAt),
    };
  }
  if (m.card) {
    return {
      role: m.role,
      content: [{ type: 'tool-call', toolCallId: m.id, toolName: 'card', args: m.card, result: {} }],
      id: m.id,
      createdAt: new Date(m.createdAt),
    };
  }
  return {
    role: m.role,
    content: [{ type: 'text', text: m.text }],
    id: m.id,
    createdAt: new Date(m.createdAt),
  };
};

/** SSE payload shapes emitted by the host. */
type MessageEventPayload = {
  threadId: string | null;
  message: {
    id: string;
    role: 'assistant';
    text: string;
    createdAt: string;
    card?: MyMessage['card'];
    question?: MyMessage['question'];
  };
};

type AnsweredEventPayload = {
  questionId: string;
  value: string;
};

type TypingEventPayload = {
  threadId: string | null;
};

/**
 * Load a thread's transcript from the host and hydrate it into the store,
 * once per thread. Called on connect (for the selected thread) and on switch.
 * A host that's down or a thread with no session yet leaves the in-memory
 * state untouched.
 */
async function fetchHistory(threadId: string): Promise<void> {
  if (useStore.getState().hydrated[threadId]) return;
  try {
    const res = await fetch(`/api/history?threadId=${encodeURIComponent(threadId)}`, { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = (await res.json()) as { messages: MyMessage[] };
    const history = data.messages ?? [];
    const local = useStore.getState().messages[threadId] ?? [];
    // Don't wipe live/optimistic messages if the host has nothing to offer.
    if (history.length === 0 && local.length > 0) {
      useStore.getState().setThreadMessages(threadId, local);
      return;
    }
    useStore.getState().setThreadMessages(threadId, history);
  } catch {
    // Host unreachable — keep whatever is in memory.
  }
}

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const currentThreadId = useStore((s) => s.currentThreadId);
  const messages = useStore((s) => s.messages[s.currentThreadId] ?? []);
  const isRunning = useStore((s) => s.running[s.currentThreadId] ?? false);
  const threadIds = useStore((s) => s.threadIds);
  const titles = useStore((s) => s.titles);

  const onNew = async (message: AppendMessage) => {
    const threadId = useStore.getState().currentThreadId;
    const text = message.content.find((p) => p.type === 'text')?.text ?? '';
    await sendUserMessage(threadId, text);
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
      void fetchHistory(id);
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

  // On connect: hydrate the thread list from the host, then load the selected
  // thread's transcript. Runs once; new/unpersisted threads are left as-is.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/threads', { credentials: 'same-origin' });
        if (res.ok) {
          const data = (await res.json()) as { threads: { threadId: string; title: string }[] };
          if (!cancelled && data.threads?.length) {
            useStore.getState().hydrateThreadList(data.threads);
          }
        }
      } catch {
        // Host unreachable — start with the empty in-memory thread.
      }
      if (!cancelled) await fetchHistory(useStore.getState().currentThreadId);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Open a single SSE connection for the lifetime of the app.
  useEffect(() => {
    // Cookie is sent automatically for same-origin EventSource; the server
    // scopes the stream to the authenticated user's own platform_id.
    const source = new EventSource('/api/stream');

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
        card: payload.message.card,
        question: payload.message.question,
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

    const onAnswered = (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as AnsweredEventPayload;
      useStore.getState().answerQuestion(payload.questionId, payload.value);
    };

    source.addEventListener('message', onMessage);
    source.addEventListener('typing', onTyping);
    source.addEventListener('answered', onAnswered);
    // "ready" is informational; no handler needed beyond the open connection.

    return () => {
      source.removeEventListener('message', onMessage);
      source.removeEventListener('typing', onTyping);
      source.removeEventListener('answered', onAnswered);
      source.close();
    };
  }, []);

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
