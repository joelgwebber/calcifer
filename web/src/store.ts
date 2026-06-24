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

    appendMessage: (threadId, message) =>
      set((s) => {
        const existing = s.messages[threadId] ?? [];
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
