import { create } from 'zustand';
import { uuid } from './uuid';

/**
 * Structured card (send_card). Mirrors the host's WebCard shape
 * (src/channels/web-cards.ts) — the two packages don't share modules, so keep
 * these in sync by hand.
 */
export type CardAction = {
  label: string;
  url: string;
  style?: 'primary' | 'danger' | 'default';
};

/** Present when a card is a live projection of a view record (calcifer-2588). */
export type CardRecord = {
  view: string;
  id: string;
  starred: boolean;
  subtitle?: string;
  thumbnail?: string;
  badges?: string[];
};

export type Card = {
  title?: string;
  description?: string;
  children?: string[];
  actions?: CardAction[];
  fallbackText?: string;
  record?: CardRecord;
};

/**
 * Interactive prompt (ask_user_question / approval). Mirrors the host's
 * ask_question payload (calcifer-7c3a.5).
 */
export type QuestionOption = { label: string; value: string; selectedLabel: string };

export type Question = {
  questionId: string;
  title: string;
  question: string;
  options: QuestionOption[];
  /** Selected option value once answered (this session or another tab). */
  answer?: string;
  /** History-loaded prompts are inert — shown resolved, not clickable. */
  resolved?: boolean;
};

export type MyMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  /** Present when this assistant turn is a structured card (calcifer-7c3a.4). */
  card?: Card;
  /** Present when this assistant turn is an interactive prompt (calcifer-7c3a.5). */
  question?: Question;
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
   * Per-thread live activity label ("Thinking…", "Reading listings.db", …)
   * pushed over the SSE `status` event (calcifer-5b6b). null/absent = no
   * specific label; the indicator falls back to animated dots while running.
   */
  status: Record<string, string | null>;
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
  /** Return an archived thread to the active list (calcifer-77be / B4 rescue). */
  restoreThread: (threadId: string, title: string) => void;
  setRunning: (threadId: string, running: boolean) => void;
  /** Set (or clear, with null) the live activity label for a thread. */
  setStatus: (threadId: string, label: string | null) => void;
  /** Ensure a thread entry exists (for out-of-band/pushed messages). */
  ensureThread: (threadId: string) => void;
  /** Replace the thread list with the host's known conversations (on connect). */
  hydrateThreadList: (threads: { threadId: string; title: string }[]) => void;
  /** Replace a thread's transcript with host-loaded history and mark it hydrated. */
  setThreadMessages: (threadId: string, messages: MyMessage[]) => void;
  /** Mark an interactive prompt answered (by questionId, across all threads). */
  answerQuestion: (questionId: string, value: string) => void;
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
    status: {},
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

    restoreThread: (threadId, title) =>
      set((s) => {
        // Idempotent: if it's somehow already active, leave the list untouched.
        if (s.threadIds.includes(threadId)) return {};
        return {
          threadIds: [threadId, ...s.threadIds],
          messages: { ...s.messages, [threadId]: s.messages[threadId] ?? [] },
          titles: { ...s.titles, [threadId]: title || DEFAULT_TITLE },
          running: { ...s.running, [threadId]: s.running[threadId] ?? false },
        };
      }),

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

    setRunning: (threadId, running) =>
      set((s) => ({
        running: { ...s.running, [threadId]: running },
        // A finished turn has no activity — drop any lingering label so the
        // indicator doesn't freeze on the last thing the agent was doing.
        status: running ? s.status : { ...s.status, [threadId]: null },
      })),

    setStatus: (threadId, label) => set((s) => ({ status: { ...s.status, [threadId]: label } })),

    answerQuestion: (questionId, value) =>
      set((s) => {
        const messages = { ...s.messages };
        for (const tid of Object.keys(messages)) {
          let changed = false;
          const list = messages[tid].map((m) => {
            if (m.question && m.question.questionId === questionId && m.question.answer == null) {
              changed = true;
              return { ...m, question: { ...m.question, answer: value } };
            }
            return m;
          });
          if (changed) messages[tid] = list;
        }
        return { messages };
      }),
  };
});
