/**
 * Hardcover MCP Server for NanoClaw
 * Provides reading list management via Hardcover's GraphQL API.
 *
 * Auth: Bearer token from hardcover.app/account/api
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_URL = 'https://api.hardcover.app/v1/graphql';
const TOKEN = process.env.HARDCOVER_API_TOKEN;

if (!TOKEN) {
  console.error('HARDCOVER_API_TOKEN not set');
  process.exit(1);
}

// Status IDs used by Hardcover
const STATUS = { TO_READ: 1, READING: 2, READ: 3, DNF: 4 } as const;
const STATUS_NAMES: Record<number, string> = { 1: 'To Read', 2: 'Reading', 3: 'Read', 4: 'Did Not Finish' };

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  if (!resp.ok) throw new Error(`Hardcover API error (${resp.status}): ${await resp.text()}`);
  const json = await resp.json() as { data: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join('; '));
  return json.data;
}

function fmtRating(r: number | null | undefined): string {
  if (!r) return 'unrated';
  // Hardcover stores ratings as 0–10 (half-stars); display as x/5
  return `${(r / 2).toFixed(1)}/5`;
}

function authorNames(contributions: { author: { name: string } }[]): string {
  return contributions.map(c => c.author.name).join(', ') || 'Unknown';
}

const server = new McpServer({ name: 'hardcover', version: '1.0.0' });

server.tool(
  'hardcover_get_profile',
  'Get the Hardcover user profile: username, total books read, and current year reading goal progress.',
  {},
  async () => {
    const year = new Date().getFullYear();
    const data = await gql<{ me: { id: number; username: string; name: string; books_count: number }[] }>(
      `query Me {
        me {
          id
          username
          name
          books_count
        }
      }`
    );
    const me = data.me[0];
    if (!me) throw new Error('Could not fetch profile — check HARDCOVER_API_TOKEN');

    const lines = [
      `**${me.name || me.username}** (@${me.username})`,
      `Books read (all time): ${me.books_count}`,
      `Year: ${year}`,
    ];
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  },
);

server.tool(
  'hardcover_get_currently_reading',
  'List books currently being read, with page progress.',
  {},
  async () => {
    const data = await gql<{
      me: {
        user_books: {
          id: number;
          current_page: number | null;
          book: {
            id: number;
            title: string;
            pages: number | null;
            contributions: { author: { name: string } }[];
          };
        }[];
      }[];
    }>(
      `query CurrentlyReading {
        me {
          user_books(
            where: { status_id: { _eq: 2 } }
            order_by: { updated_at: desc }
          ) {
            id
            current_page
            book {
              id
              title
              pages
              contributions { author { name } }
            }
          }
        }
      }`
    );

    const books = data.me[0]?.user_books ?? [];
    if (books.length === 0) return { content: [{ type: 'text' as const, text: 'Not currently reading anything.' }] };

    const formatted = books.map(ub => {
      const progress = ub.current_page != null && ub.book.pages
        ? ` — page ${ub.current_page}/${ub.book.pages} (${Math.round((ub.current_page / ub.book.pages) * 100)}%)`
        : ub.current_page != null ? ` — page ${ub.current_page}` : '';
      return `• **${ub.book.title}** by ${authorNames(ub.book.contributions)}${progress}\n  user_book_id: ${ub.id}`;
    }).join('\n\n');

    return { content: [{ type: 'text' as const, text: `Currently reading (${books.length}):\n\n${formatted}` }] };
  },
);

server.tool(
  'hardcover_get_books_read',
  'List books already read, with ratings. Sorted newest first.',
  {
    limit: z.number().int().min(1).max(200).optional().describe('Max results (default 50)'),
  },
  async (args) => {
    const limit = args.limit ?? 50;
    const data = await gql<{
      me: {
        user_books: {
          id: number;
          rating: number | null;
          book: {
            id: number;
            title: string;
            release_year: number | null;
            contributions: { author: { name: string } }[];
          };
        }[];
      }[];
    }>(
      `query BooksRead($limit: Int!) {
        me {
          user_books(
            where: { status_id: { _eq: 3 } }
            order_by: { updated_at: desc }
            limit: $limit
          ) {
            id
            rating
            book {
              id
              title
              release_year
              contributions { author { name } }
            }
          }
        }
      }`,
      { limit },
    );

    const books = data.me[0]?.user_books ?? [];
    if (books.length === 0) return { content: [{ type: 'text' as const, text: 'No books marked as read.' }] };

    const formatted = books.map((ub, i) => {
      const year = ub.book.release_year ? ` (${ub.book.release_year})` : '';
      return `${i + 1}. **${ub.book.title}**${year} by ${authorNames(ub.book.contributions)} — ${fmtRating(ub.rating)}`;
    }).join('\n');

    return { content: [{ type: 'text' as const, text: `Read books (${books.length}):\n\n${formatted}` }] };
  },
);

server.tool(
  'hardcover_get_to_read',
  'List books on the To Read (TBR) list.',
  {
    limit: z.number().int().min(1).max(200).optional().describe('Max results (default 50)'),
  },
  async (args) => {
    const limit = args.limit ?? 50;
    const data = await gql<{
      me: {
        user_books: {
          id: number;
          book: {
            id: number;
            title: string;
            release_year: number | null;
            contributions: { author: { name: string } }[];
          };
        }[];
      }[];
    }>(
      `query ToRead($limit: Int!) {
        me {
          user_books(
            where: { status_id: { _eq: 1 } }
            order_by: { updated_at: desc }
            limit: $limit
          ) {
            id
            book {
              id
              title
              release_year
              contributions { author { name } }
            }
          }
        }
      }`,
      { limit },
    );

    const books = data.me[0]?.user_books ?? [];
    if (books.length === 0) return { content: [{ type: 'text' as const, text: 'To-read list is empty.' }] };

    const formatted = books.map((ub, i) => {
      const year = ub.book.release_year ? ` (${ub.book.release_year})` : '';
      return `${i + 1}. **${ub.book.title}**${year} by ${authorNames(ub.book.contributions)}\n   book_id: ${ub.book.id}  user_book_id: ${ub.id}`;
    }).join('\n\n');

    return { content: [{ type: 'text' as const, text: `To-read list (${books.length}):\n\n${formatted}` }] };
  },
);

server.tool(
  'hardcover_search_books',
  'Search Hardcover for books by title. Returns book IDs needed for hardcover_add_book.',
  {
    query: z.string().describe('Title search string'),
    limit: z.number().int().min(1).max(20).optional().describe('Max results (default 10)'),
  },
  async (args) => {
    const limit = args.limit ?? 10;
    const data = await gql<{
      books: {
        id: number;
        title: string;
        release_year: number | null;
        pages: number | null;
        contributions: { author: { name: string } }[];
      }[];
    }>(
      `query SearchBooks($q: String!, $limit: Int!) {
        books(
          where: { title: { _ilike: $q } }
          order_by: { users_read_count: desc_nulls_last }
          limit: $limit
        ) {
          id
          title
          release_year
          pages
          contributions { author { name } }
        }
      }`,
      { q: `%${args.query}%`, limit },
    );

    const books = data.books;
    if (books.length === 0) return { content: [{ type: 'text' as const, text: `No books found for "${args.query}".` }] };

    const formatted = books.map((b, i) => {
      const year = b.release_year ? ` (${b.release_year})` : '';
      const pages = b.pages ? `, ${b.pages}p` : '';
      return `${i + 1}. **${b.title}**${year} by ${authorNames(b.contributions)}${pages}\n   book_id: ${b.id}`;
    }).join('\n\n');

    return { content: [{ type: 'text' as const, text: `Search results for "${args.query}" (${books.length}):\n\n${formatted}` }] };
  },
);

server.tool(
  'hardcover_add_book',
  'Add a book to your Hardcover list. Use book_id from hardcover_search_books.',
  {
    book_id: z.number().int().describe('Hardcover book ID'),
    status: z.enum(['to_read', 'reading', 'read']).describe('Reading status'),
  },
  async (args) => {
    const statusId = args.status === 'to_read' ? STATUS.TO_READ : args.status === 'reading' ? STATUS.READING : STATUS.READ;
    const data = await gql<{ insert_user_books_one: { id: number; status_id: number } }>(
      `mutation AddBook($bookId: Int!, $statusId: Int!) {
        insert_user_books_one(object: { book_id: $bookId, status_id: $statusId }) {
          id
          status_id
        }
      }`,
      { bookId: args.book_id, statusId },
    );

    const result = data.insert_user_books_one;
    return {
      content: [{
        type: 'text' as const,
        text: `Added book ${args.book_id} to your list as "${STATUS_NAMES[result.status_id]}" (user_book_id: ${result.id})`,
      }],
    };
  },
);

server.tool(
  'hardcover_update_progress',
  'Update reading progress for a book currently being read. Use user_book_id from hardcover_get_currently_reading.',
  {
    user_book_id: z.number().int().describe('user_book_id from hardcover_get_currently_reading'),
    current_page: z.number().int().min(0).describe('Current page number'),
  },
  async (args) => {
    const data = await gql<{ update_user_books_by_pk: { id: number; current_page: number } }>(
      `mutation UpdateProgress($id: Int!, $page: Int!) {
        update_user_books_by_pk(
          pk_columns: { id: $id }
          _set: { current_page: $page }
        ) {
          id
          current_page
        }
      }`,
      { id: args.user_book_id, page: args.current_page },
    );

    const result = data.update_user_books_by_pk;
    if (!result) throw new Error(`user_book_id ${args.user_book_id} not found`);

    return {
      content: [{
        type: 'text' as const,
        text: `Updated progress to page ${result.current_page} (user_book_id: ${result.id})`,
      }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
