import { useStore, type Question } from '../store';

async function postAction(questionId: string, value: string): Promise<void> {
  await fetch('/api/action', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, value }),
  });
}

/**
 * Renders an interactive prompt (ask_user_question + host/onecli approvals, all
 * `ask_question` payloads) as an inline card with option buttons — the
 * human-in-the-loop tool UI (calcifer-7c3a.5). A click optimistically marks the
 * prompt answered in the store and POSTs to /api/action, which hands the choice
 * to the host's onAction -> dispatchResponse.
 *
 * Registered as the `question` tool UI in Thread.tsx, so it receives the
 * normalized question as the tool-call `args`.
 */
export function QuestionMessagePart({ args }: { args: Question }) {
  const q = args;
  const answered = q.answer != null;
  const selected = answered ? q.options.find((o) => o.value === q.answer) : undefined;

  function pick(value: string) {
    useStore.getState().answerQuestion(q.questionId, value);
    void postAction(q.questionId, value);
  }

  return (
    <div className="chat-question">
      {q.title && <div className="chat-question-title">{q.title}</div>}
      {q.question && <div className="chat-question-body">{q.question}</div>}
      {answered ? (
        <div className="chat-question-answered">✓ {selected?.selectedLabel ?? q.answer}</div>
      ) : q.resolved ? (
        <div className="chat-question-resolved">This prompt is no longer awaiting a response.</div>
      ) : (
        <div className="chat-question-options">
          {q.options.map((o) => (
            <button key={o.value} className="chat-question-option" onClick={() => pick(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
