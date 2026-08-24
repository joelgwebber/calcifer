/**
 * Fastmail MCP Server for NanoClaw
 * Provides email (IMAP/SMTP), calendar (CalDAV), and contacts (CardDAV)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import Imap, { Box, ImapMessageAttributes } from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import nodemailer from 'nodemailer';
import type { Readable } from 'stream';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';

// Resolve per-install; created lazily when an attachment is actually saved so
// importing this module never has a filesystem side effect (a top-level
// mkdirSync would crash the MCP server if the path were unwritable).
const ATTACHMENT_DIR =
  process.env.FASTMAIL_ATTACHMENT_DIR ?? '/workspace/agent/email-attachments';

const FASTMAIL_EMAIL = process.env.FASTMAIL_EMAIL!;
const FASTMAIL_APP_PASSWORD = process.env.FASTMAIL_APP_PASSWORD!;

// IMAP Configuration
const imapConfig = {
  user: FASTMAIL_EMAIL,
  password: FASTMAIL_APP_PASSWORD,
  host: 'imap.fastmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
};

// SMTP Configuration
const smtpTransporter = nodemailer.createTransport({
  host: 'smtp.fastmail.com',
  port: 465,
  secure: true,
  auth: {
    user: FASTMAIL_EMAIL,
    pass: FASTMAIL_APP_PASSWORD,
  },
});

// XML Parser for CalDAV/CardDAV responses
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
});

// CalDAV/CardDAV helper
async function davRequest(url: string, method: string, body?: string, depth?: string): Promise<any> {
  const auth = Buffer.from(`${FASTMAIL_EMAIL}:${FASTMAIL_APP_PASSWORD}`).toString('base64');
  const headers: Record<string, string> = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/xml; charset=utf-8',
  };
  if (depth) {
    headers['Depth'] = depth;
  }
  if (body) {
    headers['Content-Length'] = Buffer.byteLength(body).toString();
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DAV request failed (${response.status}): ${errorText}`);
  }

  return response.text();
}

// IMAP helper to get connection
function getImapConnection(): Promise<Imap> {
  return new Promise((resolve, reject) => {
    const imap = new Imap(imapConfig);
    imap.once('ready', () => resolve(imap));
    imap.once('error', reject);
    imap.connect();
  });
}

// node-imap search criteria: flags like 'SEEN' are plain strings, but
// keyword+value pairs like SUBJECT must be sub-arrays: [["SUBJECT", "foo"]].
// This converts a flat array ["SUBJECT", "Cricket", "SEEN"] into the correct
// nested form [["SUBJECT", "Cricket"], "SEEN"].
const IMAP_VALUE_KEYS = new Set([
  'SUBJECT', 'FROM', 'TO', 'CC', 'BCC', 'TEXT', 'BODY',
  'BEFORE', 'ON', 'SINCE', 'SENTSINCE', 'SENTBEFORE', 'SENTON',
  'LARGER', 'SMALLER', 'UID', 'KEYWORD', 'UNKEYWORD',
]);

function parseSearchCriteria(criteria: string[]): any[] {
  const result: any[] = [];
  let i = 0;
  while (i < criteria.length) {
    if (IMAP_VALUE_KEYS.has(criteria[i].toUpperCase()) && i + 1 < criteria.length) {
      result.push([criteria[i], criteria[i + 1]]);
      i += 2;
    } else {
      result.push(criteria[i]);
      i++;
    }
  }
  return result;
}

const server = new McpServer({
  name: 'fastmail',
  version: '1.0.0',
});

// ============================================================================
// EMAIL TOOLS
// ============================================================================

server.tool(
  'fastmail_list_folders',
  'List all email folders/mailboxes',
  {},
  async () => {
    const imap = await getImapConnection();

    return new Promise((resolve, reject) => {
      imap.getBoxes((err: Error, boxes: Imap.MailBoxes) => {
        imap.end();
        if (err) {
          reject(err);
          return;
        }

        const formatBoxes = (boxes: Imap.MailBoxes, prefix = ''): string[] => {
          const result: string[] = [];
          for (const [name, box] of Object.entries(boxes)) {
            const fullName = prefix ? `${prefix}/${name}` : name;
            result.push(`📁 ${fullName} (${(box as any).children ? 'has subfolders' : 'folder'})`);
            if ((box as any).children) {
              result.push(...formatBoxes((box as any).children, fullName));
            }
          }
          return result;
        };

        const formatted = formatBoxes(boxes).join('\n');
        resolve({
          content: [{
            type: 'text' as const,
            text: `Folders:\n${formatted}`
          }]
        });
      });
    });
  }
);

server.tool(
  'fastmail_list_messages',
  'List messages in a folder',
  {
    folder: z.string().default('INBOX').describe('Folder name (default: INBOX)'),
    limit: z.number().default(20).describe('Maximum number of messages to retrieve'),
    search: z.array(z.string()).optional().describe('IMAP search criteria (e.g., ["UNSEEN"] or ["FROM", "user@example.com"])'),
  },
  async (args) => {
    const imap = await getImapConnection();

    return new Promise((resolve, reject) => {
      imap.once('error', (err: Error) => { imap.destroy(); reject(err); });

      imap.openBox(args.folder, true, (err: Error, box: Box) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        const searchCriteria = args.search ? parseSearchCriteria(args.search) : ['ALL'];
        imap.search(searchCriteria, (err: Error, results: number[]) => {
          if (err) {
            imap.end();
            reject(err);
            return;
          }

          if (results.length === 0) {
            imap.end();
            resolve({
              content: [{
                type: 'text' as const,
                text: `No messages found in ${args.folder}`
              }]
            });
            return;
          }

          // UID SEARCH returns UIDs in ascending order, so the highest UIDs
          // are the most recent messages. Sort defensively (don't rely on
          // server ordering) and keep the newest `limit`.
          const limitedResults = [...results]
            .sort((a, b) => a - b)
            .slice(-args.limit);
          const fetch = imap.fetch(limitedResults, {
            bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
            struct: true
          });

          const messages: {
            uid: number;
            from: string;
            to: string;
            subject: string;
            date: string;
            sortKey: number;
          }[] = [];
          // simpleParser is async; each body parse is a promise we MUST await
          // before resolving, or the result set is a non-deterministic subset
          // of whatever finished parsing before fetch's 'end' fired.
          const parses: Promise<void>[] = [];

          fetch.on('message', (msg: Imap.ImapMessage, seqno: number) => {
            let msgUid = seqno;
            msg.once('attributes', (attrs: ImapMessageAttributes) => {
              msgUid = attrs.uid;
            });
            msg.on('body', (stream: Readable) => {
              parses.push(
                simpleParser(stream)
                  .then((parsed: ParsedMail) => {
                    messages.push({
                      uid: msgUid,
                      from: parsed.from?.text || 'Unknown',
                      to: parsed.to?.text || 'Unknown',
                      subject: parsed.subject || '(no subject)',
                      date: parsed.date?.toISOString() || 'Unknown',
                      sortKey: parsed.date ? parsed.date.getTime() : 0,
                    });
                  })
                  .catch(() => {
                    // Skip messages that fail to parse rather than dropping the
                    // whole batch.
                  }),
              );
            });
          });

          fetch.once('error', (err: Error) => {
            imap.end();
            reject(err);
          });

          fetch.once('end', () => {
            Promise.all(parses).then(() => {
              imap.end();
              // Present newest-first so recent mail is never buried below the
              // limit for high-volume senders/folders.
              messages.sort((a, b) => b.sortKey - a.sortKey);
              const formatted = messages.map(m =>
                `[${m.uid}] ${m.subject}\n  From: ${m.from}\n  Date: ${m.date}`
              ).join('\n\n');
              resolve({
                content: [{
                  type: 'text' as const,
                  text: `Messages in ${args.folder} (${messages.length} shown, newest first):\n\n${formatted}`
                }]
              });
            });
          });
        });
      });
    });
  }
);

server.tool(
  'fastmail_read_message',
  'Read the full content of a message',
  {
    folder: z.string().default('INBOX').describe('Folder name'),
    uid: z.number().describe('Message UID from list_messages'),
  },
  async (args) => {
    const imap = await getImapConnection();

    return new Promise((resolve, reject) => {
      imap.openBox(args.folder, true, (err: Error) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        imap.search([['UID', args.uid.toString()]], (searchErr: Error, seqnos: number[]) => {
          if (searchErr || !seqnos || seqnos.length === 0) {
            imap.end();
            reject(new Error(`Message UID ${args.uid} not found in ${args.folder}`));
            return;
          }

          const fetch = imap.fetch(seqnos, { bodies: '' });

          fetch.on('message', (msg: Imap.ImapMessage) => {
            msg.on('body', (stream: Readable) => {
              simpleParser(stream, (err: Error | undefined, parsed: ParsedMail) => {
                imap.end();
                if (err) {
                  reject(err);
                  return;
                }

                const text = parsed.text || parsed.html || '(no content)';

                const savedAttachments: string[] = [];
                const realAttachments = (parsed.attachments ?? []).filter(
                  (att) => att.content && att.contentDisposition !== 'inline',
                );
                if (realAttachments.length > 0) {
                  fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });
                  for (const att of realAttachments) {
                    const safeName = (att.filename || `attachment-${Date.now()}`)
                      .replace(/[^a-zA-Z0-9._-]/g, '_');
                    const dest = path.join(ATTACHMENT_DIR, safeName);
                    fs.writeFileSync(dest, att.content);
                    savedAttachments.push(dest);
                  }
                }

                const attachmentSection = savedAttachments.length > 0
                  ? `\n\nAttachments saved:\n${savedAttachments.map(p => `  ${p}`).join('\n')}`
                  : '';

                resolve({
                  content: [{
                    type: 'text' as const,
                    text: `From: ${parsed.from?.text}\nTo: ${parsed.to?.text}\nSubject: ${parsed.subject}\nDate: ${parsed.date?.toISOString()}\n\n${text}${attachmentSection}`
                  }]
                });
              });
            });
          });

          fetch.once('error', (err: Error) => {
            imap.end();
            reject(err);
          });
        });
      });
    });
  }
);

server.tool(
  'fastmail_send_message',
  'Send an email message',
  {
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body (plain text)'),
    cc: z.string().optional().describe('CC recipients (comma-separated)'),
    bcc: z.string().optional().describe('BCC recipients (comma-separated)'),
  },
  async (args) => {
    const mailOptions = {
      from: FASTMAIL_EMAIL,
      to: args.to,
      subject: args.subject,
      text: args.body,
      cc: args.cc,
      bcc: args.bcc,
    };

    const info = await smtpTransporter.sendMail(mailOptions);

    return {
      content: [{
        type: 'text' as const,
        text: `Email sent successfully!\nMessage ID: ${info.messageId}\nTo: ${args.to}\nSubject: ${args.subject}`
      }]
    };
  }
);

// ============================================================================
// CALENDAR TOOLS (CalDAV)
// ============================================================================

async function resolveCalendarId(nameOrId: string): Promise<string> {
  const url = `https://caldav.fastmail.com/dav/calendars/user/${FASTMAIL_EMAIL}/`;
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:displayname /><d:resourcetype /></d:prop>
</d:propfind>`;
  const response = await davRequest(url, 'PROPFIND', body, '1');
  const parsed = xmlParser.parse(response);
  const responses = parsed['d:multistatus']?.['d:response'] || [];
  const responseArray = Array.isArray(responses) ? responses : [responses];
  for (const r of responseArray) {
    const href: string = r['d:href'] || '';
    const propstat = Array.isArray(r['d:propstat']) ? r['d:propstat'][0] : r['d:propstat'];
    const prop = propstat?.['d:prop'];
    if (!prop || !('c:calendar' in (prop['d:resourcetype'] || {}))) continue;
    const displayname: string = prop['d:displayname'] || '';
    const pathId = href.split('/').filter(Boolean).pop() || '';
    if (displayname === nameOrId || pathId === nameOrId) return pathId;
  }
  return nameOrId;
}

server.tool(
  'fastmail_list_calendars',
  'List all calendars',
  {},
  async () => {
    const url = `https://caldav.fastmail.com/dav/calendars/user/${FASTMAIL_EMAIL}/`;
    const body = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
    <c:calendar-description />
  </d:prop>
</d:propfind>`;

    const response = await davRequest(url, 'PROPFIND', body, '1');
    const parsed = xmlParser.parse(response);

    // Extract calendar entries from the multistatus response
    const multistatus = parsed['d:multistatus'];
    const responses = multistatus?.['d:response'] || [];
    const responseArray = Array.isArray(responses) ? responses : [responses];

    const calendars = responseArray
      .map((r: any) => {
        const href = r['d:href'] || '';
        // d:propstat is an array - get the first one
        const propstatArray = r['d:propstat'];
        const propstat = Array.isArray(propstatArray) ? propstatArray[0] : propstatArray;
        const prop = propstat?.['d:prop'];

        if (!prop) return null;

        const displayname = prop['d:displayname'] || '';
        const resourcetype = prop['d:resourcetype'] || {};
        const description = prop['c:calendar-description'] || '';

        // Only include items that are calendars (have both d:collection and c:calendar)
        const hasCalendar = 'c:calendar' in resourcetype;
        if (!hasCalendar || !displayname) return null;

        // Extract calendar ID from href (last path component)
        const pathParts = href.split('/').filter(Boolean);
        const calendarId = pathParts[pathParts.length - 1] || displayname;

        return `📅 ${displayname} (ID: ${calendarId})${description ? `\n   ${description}` : ''}`;
      })
      .filter(Boolean);

    if (calendars.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: 'No calendars found'
        }]
      };
    }

    return {
      content: [{
        type: 'text' as const,
        text: `Calendars:\n${calendars.join('\n\n')}\n\nTotal: ${calendars.length} calendars`
      }]
    };
  }
);

server.tool(
  'fastmail_list_events',
  'List calendar events in a date range',
  {
    calendar: z.string().default('Default').describe('Calendar name'),
    start_date: z.string().describe('Start date (ISO 8601 format, e.g., 2026-02-26T00:00:00Z)'),
    end_date: z.string().describe('End date (ISO 8601 format)'),
  },
  async (args) => {
    // Convert ISO dates to iCalendar format (YYYYMMDDTHHmmssZ)
    const formatCalDate = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const calId = await resolveCalendarId(args.calendar);
    const url = `https://caldav.fastmail.com/dav/calendars/user/${FASTMAIL_EMAIL}/${calId}/`;
    const body = `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${formatCalDate(args.start_date)}" end="${formatCalDate(args.end_date)}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

    const response = await davRequest(url, 'REPORT', body);
    const parsed = xmlParser.parse(response);

    const multistatus = parsed['d:multistatus'] || parsed.multistatus;
    const responses = multistatus?.['d:response'] || multistatus?.response || [];
    const responseArray = Array.isArray(responses) ? responses : [responses];

    // Parse iCalendar data to extract events
    const events = responseArray
      .map((r: any) => {
        // d:propstat is an array - get the first one
        const propstatArray = r['d:propstat'];
        const propstat = Array.isArray(propstatArray) ? propstatArray[0] : propstatArray;
        const prop = propstat?.['d:prop'];
        const calData = prop?.['c:calendar-data'] || '';

        if (!calData) return null;

        // Parse iCalendar format (simple regex-based parsing)
        const summary = calData.match(/SUMMARY:(.*)/)?.[1]?.trim() || '(No title)';
        const dtstart = calData.match(/DTSTART[^:]*:(.*)/)?.[1]?.trim() || '';
        const dtend = calData.match(/DTEND[^:]*:(.*)/)?.[1]?.trim() || '';
        const location = calData.match(/LOCATION:(.*)/)?.[1]?.trim() || '';
        const description = calData.match(/DESCRIPTION:(.*)/)?.[1]?.trim() || '';

        // Convert iCalendar date format to readable format
        const formatDate = (icsDate: string) => {
          if (!icsDate) return 'Unknown';
          // YYYYMMDDTHHmmssZ -> readable
          const match = icsDate.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
          if (!match) return icsDate;
          const [, year, month, day, hour, min] = match;
          return `${year}-${month}-${day} ${hour}:${min}`;
        };

        return {
          summary,
          start: formatDate(dtstart),
          end: formatDate(dtend),
          location,
          description,
        };
      })
      .filter(Boolean);

    if (events.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `No events found in ${args.calendar} (${args.start_date} to ${args.end_date})`
        }]
      };
    }

    const formatted = events.map((e: any) =>
      `📅 ${e.summary}\n   Start: ${e.start}\n   End: ${e.end}${e.location ? `\n   Location: ${e.location}` : ''}${e.description ? `\n   ${e.description}` : ''}`
    ).join('\n\n');

    return {
      content: [{
        type: 'text' as const,
        text: `Events in ${args.calendar} (${args.start_date} to ${args.end_date}):\n\n${formatted}\n\nTotal: ${events.length} events`
      }]
    };
  }
);

server.tool(
  'fastmail_create_event',
  'Create a new calendar event',
  {
    calendar: z.string().default('Default').describe('Calendar name'),
    summary: z.string().describe('Event title/summary'),
    start: z.string().describe('Start time (ISO 8601)'),
    end: z.string().describe('End time (ISO 8601)'),
    description: z.string().optional().describe('Event description'),
    location: z.string().optional().describe('Event location'),
  },
  async (args) => {
    const eventId = `event-${Date.now()}`;
    const calId = await resolveCalendarId(args.calendar);
    const url = `https://caldav.fastmail.com/dav/calendars/user/${FASTMAIL_EMAIL}/${calId}/${eventId}.ics`;

    // Convert ISO 8601 (with or without offset) to iCal format, preserving timezone
    const toIcal = (iso: string): { value: string; tzid?: string } => {
      const m = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2}|Z)?$/);
      if (!m) return { value: iso.replace(/[-:]/g, '').split('.')[0] + 'Z' };
      const local = m[1].replace(/[-:]/g, '');
      if (!m[2] || m[2] === 'Z') return { value: local + 'Z' };
      // Has an offset — emit as floating local time; caller should set calendar's timezone
      return { value: local };
    };
    const start = toIcal(args.start);
    const end = toIcal(args.end);
    const dtstart = start.tzid ? `DTSTART;TZID=${start.tzid}:${start.value}` : `DTSTART:${start.value}`;
    const dtend = end.tzid ? `DTEND;TZID=${end.tzid}:${end.value}` : `DTEND:${end.value}`;

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//NanoClaw//EN
BEGIN:VEVENT
UID:${eventId}@nanoclaw
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
${dtstart}
${dtend}
SUMMARY:${args.summary}${args.description ? `\nDESCRIPTION:${args.description}` : ''}${args.location ? `\nLOCATION:${args.location}` : ''}
END:VEVENT
END:VCALENDAR`;

    await davRequest(url, 'PUT', icsContent);

    return {
      content: [{
        type: 'text' as const,
        text: `Event created: ${args.summary}\nStart: ${args.start}\nEnd: ${args.end}\nCalendar: ${args.calendar}`
      }]
    };
  }
);

// ============================================================================
// CONTACTS TOOLS (CardDAV)
// ============================================================================

server.tool(
  'fastmail_list_contacts',
  'List all contacts',
  {
    limit: z.number().default(50).describe('Maximum number of contacts to retrieve'),
  },
  async (args) => {
    const url = `https://carddav.fastmail.com/dav/addressbooks/user/${FASTMAIL_EMAIL}/Default/`;
    // Use addressbook-query REPORT instead of PROPFIND to get contact data
    const body = `<?xml version="1.0" encoding="utf-8" ?>
<card:addressbook-query xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:getetag />
    <card:address-data />
  </d:prop>
</card:addressbook-query>`;

    const response = await davRequest(url, 'REPORT', body, '0');
    const parsed = xmlParser.parse(response);

    const multistatus = parsed['d:multistatus'] || parsed.multistatus;
    const responses = multistatus?.['d:response'] || multistatus?.response || [];
    const responseArray = Array.isArray(responses) ? responses : [responses];

    // Parse vCard data to extract contacts
    const contacts = responseArray
      .map((r: any) => {
        // d:propstat is an array - get the first one
        const propstatArray = r['d:propstat'];
        const propstat = Array.isArray(propstatArray) ? propstatArray[0] : propstatArray;
        const prop = propstat?.['d:prop'];
        const cardData = prop?.['card:address-data'] || '';

        if (!cardData || !cardData.includes('BEGIN:VCARD')) return null;

        // Parse vCard format (simple regex-based parsing)
        const fn = cardData.match(/FN:(.*)/)?.[1]?.trim() || 'Unknown';
        const emailMatch = cardData.match(/EMAIL[^:]*:(.*)/);
        const email = emailMatch?.[1]?.trim() || '';
        const telMatch = cardData.match(/TEL[^:]*:(.*)/);
        const tel = telMatch?.[1]?.trim() || '';
        const org = cardData.match(/ORG:(.*)/)?.[1]?.trim() || '';

        return { fn, email, tel, org };
      })
      .filter(Boolean)
      .slice(0, args.limit);

    if (contacts.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: 'No contacts found'
        }]
      };
    }

    const formatted = contacts.map((c: any) =>
      `👤 ${c.fn}${c.email ? `\n   Email: ${c.email}` : ''}${c.tel ? `\n   Phone: ${c.tel}` : ''}${c.org ? `\n   Org: ${c.org}` : ''}`
    ).join('\n\n');

    return {
      content: [{
        type: 'text' as const,
        text: `Contacts (showing ${contacts.length}):\n\n${formatted}`
      }]
    };
  }
);

server.tool(
  'fastmail_search_contacts',
  'Search contacts by name or email',
  {
    query: z.string().describe('Search query (name or email)'),
  },
  async (args) => {
    const url = `https://carddav.fastmail.com/dav/addressbooks/user/${FASTMAIL_EMAIL}/Default/`;
    // Use addressbook-query REPORT instead of PROPFIND to get contact data
    const body = `<?xml version="1.0" encoding="utf-8" ?>
<card:addressbook-query xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <card:address-data />
  </d:prop>
</card:addressbook-query>`;

    const response = await davRequest(url, 'REPORT', body, '0');
    const parsed = xmlParser.parse(response);

    const multistatus = parsed['d:multistatus'] || parsed.multistatus;
    const responses = multistatus?.['d:response'] || multistatus?.response || [];
    const responseArray = Array.isArray(responses) ? responses : [responses];

    const queryLower = args.query.toLowerCase();

    // Parse and filter contacts
    const contacts = responseArray
      .map((r: any) => {
        // d:propstat is an array - get the first one
        const propstatArray = r['d:propstat'];
        const propstat = Array.isArray(propstatArray) ? propstatArray[0] : propstatArray;
        const prop = propstat?.['d:prop'];
        const cardData = prop?.['card:address-data'] || '';

        if (!cardData || !cardData.includes('BEGIN:VCARD')) return null;

        const fn = cardData.match(/FN:(.*)/)?.[1]?.trim() || 'Unknown';
        const emailMatch = cardData.match(/EMAIL[^:]*:(.*)/);
        const email = emailMatch?.[1]?.trim() || '';
        const telMatch = cardData.match(/TEL[^:]*:(.*)/);
        const tel = telMatch?.[1]?.trim() || '';
        const org = cardData.match(/ORG:(.*)/)?.[1]?.trim() || '';

        // Filter by query
        if (
          !fn.toLowerCase().includes(queryLower) &&
          !email.toLowerCase().includes(queryLower) &&
          !org.toLowerCase().includes(queryLower)
        ) {
          return null;
        }

        return { fn, email, tel, org };
      })
      .filter(Boolean);

    if (contacts.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `No contacts found matching "${args.query}"`
        }]
      };
    }

    const formatted = contacts.map((c: any) =>
      `👤 ${c.fn}${c.email ? `\n   Email: ${c.email}` : ''}${c.tel ? `\n   Phone: ${c.tel}` : ''}${c.org ? `\n   Org: ${c.org}` : ''}`
    ).join('\n\n');

    return {
      content: [{
        type: 'text' as const,
        text: `Search results for "${args.query}" (${contacts.length} found):\n\n${formatted}`
      }]
    };
  }
);

const transport = new StdioServerTransport();
server.connect(transport);
