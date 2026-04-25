/**
 * reMarkable MCP Server for NanoClaw
 * Uses sync v3/v4 API for listing/download, simple /doc/v2/files for upload.
 *
 * Auth: device token (long-lived) → user token (refreshed each session, <24h TTL).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { zipSync } from 'fflate';

const DEVICE_TOKEN = process.env.REMARKABLE_DEVICE_TOKEN;
const AUTH_HOST = 'https://webapp-prod.cloud.remarkable.engineering';
const SYNC_HOST = 'https://eu.tectonic.remarkable.com';
const UPLOAD_HOST = 'https://internal.cloud.remarkable.com';

if (!DEVICE_TOKEN) {
  console.error('REMARKABLE_DEVICE_TOKEN not set');
  process.exit(1);
}

let userToken: string | null = null;

async function refreshUserToken(): Promise<string> {
  const response = await fetch(`${AUTH_HOST}/token/json/2/user/new`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DEVICE_TOKEN}` },
  });
  if (!response.ok) {
    throw new Error(`Token refresh failed (${response.status}): ${await response.text()}`);
  }
  userToken = await response.text();
  return userToken;
}

async function getToken(): Promise<string> {
  return userToken ?? refreshUserToken();
}

async function syncGet(urlPath: string): Promise<Response> {
  const doGet = async (token: string) =>
    fetch(`${SYNC_HOST}${urlPath}`, { headers: { 'Authorization': `Bearer ${token}` } });
  let resp = await doGet(await getToken());
  if (resp.status === 401) {
    userToken = null;
    resp = await doGet(await refreshUserToken());
  }
  return resp;
}

async function uploadPost(urlPath: string, headers: Record<string, string>, body: Uint8Array): Promise<Response> {
  const doPost = async (token: string) =>
    fetch(`${UPLOAD_HOST}${urlPath}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, ...headers },
      body: body as unknown as BodyInit,
    });
  let resp = await doPost(await getToken());
  if (resp.status === 401) {
    userToken = null;
    resp = await doPost(await refreshUserToken());
  }
  return resp;
}

interface IndexEntry {
  hash: string;
  type: string;
  name: string;
  subfiles: number;
  size: number;
}

function parseIndex(text: string): IndexEntry[] {
  return text.trim().split('\n').slice(1).flatMap(line => {
    const parts = line.split(':');
    if (parts.length < 5) return [];
    const [hash, type, name, subfiles, size] = parts;
    return [{ hash, type, name, subfiles: parseInt(subfiles, 10) || 0, size: parseInt(size, 10) || 0 }];
  });
}

interface DocMetadata {
  visibleName: string;
  type: 'DocumentType' | 'CollectionType';
  parent: string;
  lastModified?: string;
  deleted?: boolean;
}

interface DocInfo {
  id: string;
  indexHash: string;
  metadata: DocMetadata;
}

async function getRootEntries(): Promise<IndexEntry[]> {
  const rootResp = await syncGet('/sync/v4/root');
  if (!rootResp.ok) throw new Error(`Root fetch failed (${rootResp.status}): ${await rootResp.text()}`);
  const { hash: rootHash } = await rootResp.json() as { hash: string };

  const idxResp = await syncGet(`/sync/v3/files/${rootHash}`);
  if (!idxResp.ok) throw new Error(`Root index fetch failed (${idxResp.status}): ${await idxResp.text()}`);
  return parseIndex(await idxResp.text());
}

async function getDocMetadata(docId: string, indexHash: string): Promise<DocMetadata | null> {
  const idxResp = await syncGet(`/sync/v3/files/${indexHash}`);
  if (!idxResp.ok) return null;
  const entries = parseIndex(await idxResp.text());

  const metaEntry = entries.find(e => e.name === `${docId}.metadata`);
  if (!metaEntry) return null;

  const metaResp = await syncGet(`/sync/v3/files/${metaEntry.hash}`);
  if (!metaResp.ok) return null;

  try {
    return await metaResp.json() as DocMetadata;
  } catch {
    return null;
  }
}

async function fetchAllDocs(): Promise<DocInfo[]> {
  const rootEntries = await getRootEntries();

  const results = await Promise.all(rootEntries.map(async (entry) => {
    const metadata = await getDocMetadata(entry.name, entry.hash);
    if (!metadata || metadata.deleted) return null;
    return { id: entry.name, indexHash: entry.hash, metadata } satisfies DocInfo;
  }));

  return results.filter((d): d is DocInfo => d !== null);
}

const server = new McpServer({ name: 'remarkable', version: '1.0.0' });

server.tool(
  'remarkable_list',
  'List all notebooks, PDFs, and folders on the reMarkable cloud.',
  {
    folder_id: z.string().optional().describe('Parent folder ID to filter by (omit for all items)'),
  },
  async (args) => {
    const docs = await fetchAllDocs();
    const items = args.folder_id
      ? docs.filter(d => d.metadata.parent === args.folder_id)
      : docs;

    items.sort((a, b) => {
      const at = a.metadata.type, bt = b.metadata.type;
      if (at !== bt) return at === 'CollectionType' ? -1 : 1;
      return a.metadata.visibleName.localeCompare(b.metadata.visibleName);
    });

    if (items.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No items found.' }] };
    }

    const formatted = items.map(d => {
      const icon = d.metadata.type === 'CollectionType' ? '📁' : '📄';
      const ts = d.metadata.lastModified ? parseInt(d.metadata.lastModified, 10) : NaN;
      const date = isNaN(ts) ? 'unknown' : new Date(ts).toLocaleDateString();
      return `${icon} ${d.metadata.visibleName}\n   ID: ${d.id}  Modified: ${date}`;
    }).join('\n\n');

    return {
      content: [{ type: 'text' as const, text: `${items.length} items:\n\n${formatted}` }],
    };
  },
);

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.epub': 'application/epub+zip',
};

server.tool(
  'remarkable_upload_pdf',
  'Upload a PDF or EPUB to the reMarkable cloud. Appears on the device after the next sync. Note: uploads always go to the root folder.',
  {
    file_path: z.string().describe('Absolute path to a PDF or EPUB file'),
    name: z.string().optional().describe('Display name on the device (defaults to filename without extension)'),
  },
  async (args) => {
    const ext = path.extname(args.file_path).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? 'application/pdf';
    const pdfData = await fs.readFile(args.file_path);
    const displayName = args.name ?? path.basename(args.file_path, ext);

    const resp = await uploadPost(
      '/doc/v2/files',
      {
        'Content-Type': contentType,
        'rm-meta': Buffer.from(JSON.stringify({ file_name: displayName })).toString('base64'),
        'rm-source': 'RoR-Browser',
      },
      pdfData as Uint8Array,
    );

    if (!resp.ok) {
      throw new Error(`Upload failed (${resp.status}): ${await resp.text()}`);
    }

    const result = await resp.json() as { docID: string; hash: string };
    return {
      content: [{ type: 'text' as const, text: `Uploaded "${displayName}" to reMarkable (ID: ${result.docID})\nWill appear on device after next sync.` }],
    };
  },
);

server.tool(
  'remarkable_download',
  'Download a notebook or document from reMarkable as a ZIP file. Notebooks contain .rm files (reMarkable format); use "rmc <file>.rm" to convert to PDF/markdown.',
  {
    document_id: z.string().describe('Document ID from remarkable_list'),
    output_path: z.string().describe('Destination path for the ZIP file'),
  },
  async (args) => {
    const rootEntries = await getRootEntries();
    const entry = rootEntries.find(e => e.name === args.document_id);
    if (!entry) throw new Error(`Document ${args.document_id} not found`);

    const idxResp = await syncGet(`/sync/v3/files/${entry.hash}`);
    if (!idxResp.ok) throw new Error(`Document index fetch failed (${idxResp.status})`);
    const fileEntries = parseIndex(await idxResp.text());

    const files: Record<string, Uint8Array> = {};
    await Promise.all(fileEntries.map(async (fileEntry) => {
      const resp = await syncGet(`/sync/v3/files/${fileEntry.hash}`);
      if (!resp.ok) return;
      files[fileEntry.name] = new Uint8Array(await resp.arrayBuffer());
    }));

    if (Object.keys(files).length === 0) {
      throw new Error('No files downloaded for this document');
    }

    const zipData = zipSync(files);
    await fs.mkdir(path.dirname(args.output_path), { recursive: true });
    await fs.writeFile(args.output_path, Buffer.from(zipData));

    const metaBytes = files[`${args.document_id}.metadata`];
    const docName = metaBytes
      ? ((JSON.parse(new TextDecoder().decode(metaBytes)) as { visibleName?: string }).visibleName ?? args.document_id)
      : args.document_id;

    const sizeMB = (zipData.length / 1024 / 1024).toFixed(2);
    const extractDir = path.join(path.dirname(args.output_path), args.document_id);

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Downloaded "${docName}" → ${args.output_path} (${sizeMB} MB, ${Object.keys(files).length} files)`,
          '',
          'To extract:',
          `  unzip ${args.output_path} -d ${extractDir}`,
          '',
          'To convert notebook pages to PDF (requires rmc):',
          `  cd ${extractDir} && for f in *.rm; do rmc "$f" -o "${extractDir}/$(basename $f .rm).pdf"; done`,
        ].join('\n'),
      }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
