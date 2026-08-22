/**
 * Interactive MCP tools: ask_user_question, send_card.
 *
 * ask_user_question is a blocking tool call — it writes a messages_out row
 * with a question card, then polls messages_in for the response.
 */
import { findQuestionResponse, markCompleted } from '../db/messages-in.js';
import { writeMessageOut } from '../db/messages-out.js';
import { getSessionRouting } from '../db/session-routing.js';
import { registerTools } from './server.js';
import type { McpToolDefinition } from './types.js';

function log(msg: string): void {
  console.error(`[mcp-tools] ${msg}`);
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function routing() {
  return getSessionRouting();
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function err(text: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const askUserQuestion: McpToolDefinition = {
  tool: {
    name: 'ask_user_question',
    description:
      'Ask the user a multiple-choice question and wait for their response. This is a blocking call — execution pauses until the user responds or the timeout expires. Provide a short card title (e.g. "Confirm deletion") and an array of options — each option may be a plain string (used as both button label and result value) or an object { label, selectedLabel?, value? } where selectedLabel is the text shown on the card after the user clicks.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Short card title shown above the question' },
        question: { type: 'string', description: 'The question to ask' },
        options: {
          type: 'array',
          items: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  selectedLabel: { type: 'string' },
                  value: { type: 'string' },
                },
                required: ['label'],
              },
            ],
          },
          description: 'Options for the user to choose from (string or {label, selectedLabel?, value?})',
        },
        timeout: { type: 'number', description: 'Timeout in seconds (default: 300)' },
      },
      required: ['title', 'question', 'options'],
    },
  },
  async handler(args) {
    const title = args.title as string;
    const question = args.question as string;
    const rawOptions = args.options as unknown[];
    const timeout = ((args.timeout as number) || 300) * 1000;
    if (!title || !question || !rawOptions?.length) {
      return err('title, question, and options are required');
    }

    const options = rawOptions.map((o) => {
      if (typeof o === 'string') return { label: o, selectedLabel: o, value: o };
      const obj = o as { label: string; selectedLabel?: string; value?: string };
      return {
        label: obj.label,
        selectedLabel: obj.selectedLabel ?? obj.label,
        value: obj.value ?? obj.label,
      };
    });

    const questionId = generateId();
    const r = routing();

    // Write question card to outbound.db
    await writeMessageOut({
      id: questionId,
      kind: 'chat-sdk',
      platform_id: r.platform_id,
      channel_type: r.channel_type,
      thread_id: r.thread_id,
      content: JSON.stringify({
        type: 'ask_question',
        questionId,
        title,
        question,
        options,
      }),
    });

    log(`ask_user_question: ${questionId} → "${question}" [${options.join(', ')}]`);

    // Poll for response in inbound.db (host writes the response there)
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const response = findQuestionResponse(questionId);

      if (response) {
        const parsed = JSON.parse(response.content);
        // Mark the response as completed via processing_ack (outbound.db)
        markCompleted([response.id]);

        log(`ask_user_question response: ${questionId} → ${parsed.selectedOption}`);
        return ok(parsed.selectedOption);
      }

      await sleep(1000);
    }

    log(`ask_user_question timeout: ${questionId}`);
    return err(`Question timed out after ${timeout / 1000}s`);
  },
};

export const sendCard: McpToolDefinition = {
  tool: {
    name: 'send_card',
    description: 'Send a structured card (interactive or display-only) to the current conversation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        card: {
          type: 'object',
          description: 'Card structure with title, description, and optional children/actions',
        },
        fallbackText: { type: 'string', description: 'Text fallback for platforms without card support' },
      },
      required: ['card'],
    },
  },
  async handler(args) {
    const card = args.card as Record<string, unknown>;
    if (!card) return err('card is required');

    const id = generateId();
    const r = routing();

    await writeMessageOut({
      id,
      kind: 'chat-sdk',
      platform_id: r.platform_id,
      channel_type: r.channel_type,
      thread_id: r.thread_id,
      content: JSON.stringify({ type: 'card', card, fallbackText: (args.fallbackText as string) || '' }),
    });

    log(`send_card: ${id}`);
    return ok(`Card sent (id: ${id})`);
  },
};

export const sendRecordCard: McpToolDefinition = {
  tool: {
    name: 'send_record_card',
    description:
      'Surface a specific record from a skill view (an apartment, wiki page, document, or photo) as an interactive card in the current conversation. The card is a live projection of the record: the user can star it or open it in the full view. Prefer this over send_card when the thing you want to show already exists as a view record.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        view: {
          type: 'string',
          description: "The view/library key, e.g. 'apartments', 'family-wiki', 'documents', 'pictures', 'books'.",
        },
        id: {
          type: 'string',
          description:
            "The record id. For file-backed libraries (wiki/documents/pictures/books) this is the file path relative to the library root, e.g. 'vehicles/lucid-air.md'.",
        },
        fallbackText: {
          type: 'string',
          description: 'Text shown on channels without card support (e.g. SMS). Defaults to the view/id.',
        },
      },
      required: ['view', 'id'],
    },
  },
  async handler(args) {
    const view = args.view as string;
    const id = args.id as string;
    if (!view || !id) return err('view and id are required');

    const rid = generateId();
    const r = routing();
    writeMessageOut({
      id: rid,
      kind: 'chat-sdk',
      platform_id: r.platform_id,
      channel_type: r.channel_type,
      thread_id: r.thread_id,
      content: JSON.stringify({
        type: 'record_card',
        view,
        id,
        fallbackText: (args.fallbackText as string) || `${view}: ${id}`,
      }),
    });

    log(`send_record_card: ${rid} (${view}/${id})`);
    return ok(`Record card sent (id: ${rid})`);
  },
};

export const appLink: McpToolDefinition = {
  tool: {
    name: 'app_link',
    description:
      'Build an in-app deep link to a record that already exists in a skill view (apartment, wiki page, document, photo, book). Returns a URL of the form /app/<view>/<id> that opens the record inside the web UI — browsable, interactive, and auth-scoped. Prefer this over a raw backend/download URL whenever you want to point the user at something that exists as a view record; reserve raw endpoints for explicit direct-download requests. Embed the returned link in your reply (typically as a markdown link). Pairs with send_record_card: app_link gives an inline link, send_record_card gives a full interactive card.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        view: {
          type: 'string',
          description: "The view/library key, e.g. 'apartments', 'family-wiki', 'documents', 'pictures', 'books'.",
        },
        id: {
          type: 'string',
          description:
            "The record id. For file-backed libraries this is the path relative to the library root, e.g. 'vehicles/lucid-air.md'. Pass the raw id — slashes and other characters are URL-encoded for you.",
        },
      },
      required: ['view', 'id'],
    },
  },
  async handler(args) {
    const view = args.view as string;
    const id = args.id as string;
    if (!view || !id) return err('view and id are required');
    // Relative link: the browser resolves it to an absolute, shareable URL the
    // moment a human clicks or copies it. Encode the id (paths contain slashes
    // that must become %2F) but leave the view segment as-is, matching the
    // card Open button (web/src/ui/Card.tsx).
    const link = `/app/${view}/${encodeURIComponent(id)}`;
    log(`app_link: ${view}/${id} -> ${link}`);
    return ok(link);
  },
};

registerTools([askUserQuestion, sendCard, sendRecordCard, appLink]);
