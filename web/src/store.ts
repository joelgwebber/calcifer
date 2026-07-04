import { create } from 'zustand';
import { uuid } from './uuid';

export const PLATFORM_ID = 'web:local';

export type MyMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
};

function truncate(text: string, max = 40): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + '…';
}

type State = {
  /** Ordered list of thread ids (newest first). */
  threadIds: string[];
  /** Per-thread message lists. */
  messages: Record<string, MyMessage[]>;
  /** Per-thread display titles. */
  titles: Record<string, string>;
  /** Per-thread running flag (agent is working). */
  running: Record<string, boolean>;
  /** Threads whose transcript has been loaded from the host (7c3a.2). */
  hydrated: Record<string, boolean>;
  /**
   * The selected thread id. CENTRALIZED here so the assistant-ui runtime's
   * currentThreadId and our store stay in sync — never hold this in
   * component-local state.
   */
  currentThreadId: string;
};

type Actions = {
  setCurrentThreadId: (id: string) => void;
  createThread: () => string;
  appendMessage: (threadId: string, message: MyMessage) => void;
  setTitle: (threadId: string, title: string) => void;
  renameThread: (threadId: string, title: string) => void;
  deleteThread: (threadId: string) => void;
  setRunning: (threadId: string, running: boolean) => void;
  /** Ensure a thread entry exists (for out-of-band/pushed messages). */
  ensureThread: (threadId: string) => void;
  /** Replace the thread list with the host's known conversations (on connect). */
  hydrateThreadList: (threads: { threadId: string; title: string }[]) => void;
  /** Replace a thread's transcript with host-loaded history and mark it hydrated. */
  setThreadMessages: (threadId: string, messages: MyMessage[]) => void;
};

const DEFAULT_TITLE = 'New chat';

function freshThreadId(): string {
  return uuid();
}

export const useStore = create<State & Actions>((set, get) => {
  const initialThreadId = freshThreadId();

  return {
    threadIds: [initialThreadId],
    messages: { [initialThreadId]: [] },
    titles: { [initialThreadId]: DEFAULT_TITLE },
    running: { [initialThreadId]: false },
    hydrated: {},
    currentThreadId: initialThreadId,

    setCurrentThreadId: (id) => set({ currentThreadId: id }),

    createThread: () => {
      const id = freshThreadId();
      set((s) => ({
        threadIds: [id, ...s.threadIds],
        messages: { ...s.messages, [id]: [] },
        titles: { ...s.titles, [id]: DEFAULT_TITLE },
        running: { ...s.running, [id]: false },
        currentThreadId: id,
      }));
      return id;
    },

    ensureThread: (threadId) => {
      const s = get();
      if (s.messages[threadId]) return;
      set((prev) => ({
        threadIds: [...prev.threadIds, threadId],
        messages: { ...prev.messages, [threadId]: [] },
        titles: { ...prev.titles, [threadId]: DEFAULT_TITLE },
        running: { ...prev.running, [threadId]: false },
      }));
    },

    hydrateThreadList: (threads) =>
      set((s) => {
        if (threads.length === 0) return {};
        const threadIds = threads.map((t) => t.threadId);
        const titles: Record<string, string> = {};
        const messages: Record<string, MyMessage[]> = {};
        const running: Record<string, boolean> = {};
        for (const t of threads) {
          titles[t.threadId] = t.title || DEFAULT_TITLE;
          // Preserve any messages/running state already accumulated live.
          messages[t.threadId] = s.messages[t.threadId] ?? [];
          running[t.threadId] = s.running[t.threadId] ?? false;
        }
        return { threadIds, titles, messages, running, currentThreadId: threadIds[0] };
      }),

    setThreadMessages: (threadId, msgs) =>
      set((s) => {
        const currentTitle = s.titles[threadId] ?? DEFAULT_TITLE;
        const firstUser = msgs.find((m) => m.role === 'user');
        return {
          messages: { ...s.messages, [threadId]: msgs },
          hydrated: { ...s.hydrated, [threadId]: true },
          titles:
            currentTitle === DEFAULT_TITLE && firstUser
              ? { ...s.titles, [threadId]: truncate(firstUser.text) }
              : s.titles,
        };
      }),

    appendMessage: (threadId, message) =>
      set((s) => {
        const existing = s.messages[threadId] ?? [];
        // Dedupe by id: guards against a history fetch racing an SSE push of
        // the same message.
        if (existing.some((m) => m.id === message.id)) return {};
        const wasEmpty = existing.length === 0;
        const isFirstUser = wasEmpty && message.role === 'user';
        return {
          messages: { ...s.messages, [threadId]: [...existing, message] },
          titles:
            isFirstUser && (s.titles[threadId] ?? DEFAULT_TITLE) === DEFAULT_TITLE
              ? { ...s.titles, [threadId]: truncate(message.text) }
              : s.titles,
        };
      }),

    setTitle: (threadId, title) => set((s) => ({ titles: { ...s.titles, [threadId]: title } })),

    renameThread: (threadId, title) => set((s) => ({ titles: { ...s.titles, [threadId]: title } })),

    deleteThread: (threadId) =>
      set((s) => {
        const threadIds = s.threadIds.filter((id) => id !== threadId);
        const messages = { ...s.messages };
        const titles = { ...s.titles };
        const running = { ...s.running };
        delete messages[threadId];
        delete titles[threadId];
        delete running[threadId];

        // Always keep at least one thread selected.
        let currentThreadId = s.currentThreadId;
        if (currentThreadId === threadId) {
          if (threadIds.length > 0) {
            currentThreadId = threadIds[0];
          } else {
            const id = freshThreadId();
            threadIds.push(id);
            messages[id] = [];
            titles[id] = DEFAULT_TITLE;
            running[id] = false;
            currentThreadId = id;
          }
        }

        return { threadIds, messages, titles, running, currentThreadId };
      }),

    setRunning: (threadId, running) => set((s) => ({ running: { ...s.running, [threadId]: running } })),
  };
});
