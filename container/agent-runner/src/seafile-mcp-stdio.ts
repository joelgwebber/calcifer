/**
 * Seafile MCP Server for NanoClaw
 * Provides file operations for Seafile cloud storage with hybrid local/API access
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

const SEAFILE_URL = process.env.SEAFILE_URL!;
const SEAFILE_TOKEN = process.env.SEAFILE_TOKEN!;
const SEAFILE_LOCAL_PATH = process.env.SEAFILE_LOCAL_PATH; // Optional: path to local synced libraries

interface SeafileLibrary {
  id: string;
  name: string;
  type: string;
  owner: string;
  size: number;
  encrypted: boolean;
}

interface SeafileDirEntry {
  id: string;
  name: string;
  type: 'file' | 'dir';
  size?: number;
  mtime?: number;
}

async function seafileRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${SEAFILE_URL}${endpoint}`;
  const headers = {
    'Authorization': `Token ${SEAFILE_TOKEN}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Seafile API error (${response.status}): ${errorText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

/**
 * POST a Seafile `api2` file/dir operation (mkdir, move, copy) as
 * `application/x-www-form-urlencoded`. The `api2` endpoints do NOT accept JSON
 * bodies for these operations, but `seafileRequest` defaults to JSON — sending
 * JSON is why mkdir/move silently 400'd (calcifer-225e). `/api/v2.1/` endpoints
 * (e.g. share-links) stay on JSON via their own explicit Content-Type.
 */
async function seafilePostForm(endpoint: string, params: Record<string, string>): Promise<any> {
  return seafileRequest(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
}

async function dirExists(libraryId: string, dir: string): Promise<boolean> {
  try {
    await seafileRequest(`/api2/repos/${libraryId}/dir/?p=${encodeURIComponent(dir)}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create `dir` and any missing parents. Seafile's mkdir does not create
 * intermediate directories, so we walk the path and create each missing level.
 * Idempotent (existing levels are skipped) and it surfaces real mkdir failures
 * instead of swallowing them (calcifer-225e).
 */
async function ensureDir(libraryId: string, dir: string): Promise<void> {
  if (!dir || dir === '/') return;
  const parts = dir.split('/').filter(Boolean);
  let cur = '';
  for (const part of parts) {
    cur += `/${part}`;
    if (await dirExists(libraryId, cur)) continue;
    await seafilePostForm(`/api2/repos/${libraryId}/dir/?p=${encodeURIComponent(cur)}`, { operation: 'mkdir' });
  }
}

/**
 * Move or copy a file OR directory via Seafile's v2.1 batch endpoints
 * (calcifer-9e4c). The api2 `/dir/` endpoint only supports mkdir/rename — NOT
 * move/copy — so directory relocations (and cross-library ones) 400 with
 * "Operation not supported" when sent there. sync-batch-move-item /
 * sync-batch-copy-item handle both files and directories, within or across
 * libraries, and take a JSON body (like the other /api/v2.1/ endpoints).
 * Moves/copies the item INTO `dstDir`, keeping its name.
 */
async function seafileBatchItemOp(
  operation: 'move' | 'copy',
  srcRepo: string,
  srcPath: string,
  dstRepo: string,
  dstDir: string,
): Promise<any> {
  const srcParent = srcPath.substring(0, srcPath.lastIndexOf('/')) || '/';
  const name = srcPath.split('/').filter(Boolean).pop();
  if (!name) throw new Error('cannot move/copy the library root itself');
  const endpoint =
    operation === 'move' ? '/api/v2.1/repos/sync-batch-move-item/' : '/api/v2.1/repos/sync-batch-copy-item/';
  return seafileRequest(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      src_repo_id: srcRepo,
      src_parent_dir: srcParent,
      src_dirents: [name],
      dst_repo_id: dstRepo,
      dst_parent_dir: dstDir,
    }),
  });
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  zip: 'application/zip',
};
function guessMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

// Cache for library ID -> name mapping
let libraryCache: Map<string, string> | null = null;

async function getLibraryName(libraryId: string): Promise<string | null> {
  if (!libraryCache) {
    const libraries: SeafileLibrary[] = await seafileRequest('/api2/repos/');
    libraryCache = new Map(libraries.map(lib => [lib.id, lib.name]));
  }
  return libraryCache.get(libraryId) || null;
}

function getLocalPath(libraryName: string, filePath: string): string | null {
  if (!SEAFILE_LOCAL_PATH) return null;
  // seaf-cli creates structure: {base}/{library_name}/{library_name}/...
  return path.join(SEAFILE_LOCAL_PATH, libraryName, libraryName, filePath);
}

async function tryReadLocal(
  libraryId: string,
  filePath: string,
  encoding: 'utf-8' | 'base64' = 'utf-8',
): Promise<string | null> {
  if (!SEAFILE_LOCAL_PATH) return null;

  const libraryName = await getLibraryName(libraryId);
  if (!libraryName) return null;

  const localPath = getLocalPath(libraryName, filePath);
  if (!localPath) return null;

  try {
    // Read raw bytes and encode per request: 'utf-8' text decoding is lossy for
    // binary files (PDF/DOCX/images), so callers can ask for base64 to get the
    // exact bytes back (calcifer-225e).
    if (encoding === 'base64') {
      const buf = await fs.readFile(localPath);
      return buf.toString('base64');
    }
    return await fs.readFile(localPath, 'utf-8');
  } catch (err) {
    // File doesn't exist locally or can't be read, fall back to API
    return null;
  }
}

async function tryListDirLocal(libraryId: string, dirPath: string): Promise<SeafileDirEntry[] | null> {
  if (!SEAFILE_LOCAL_PATH) return null;

  const libraryName = await getLibraryName(libraryId);
  if (!libraryName) return null;

  const localPath = getLocalPath(libraryName, dirPath);
  if (!localPath) return null;

  try {
    const entries = await fs.readdir(localPath, { withFileTypes: true });
    return Promise.all(entries.map(async entry => {
      const stats = await fs.stat(path.join(localPath, entry.name));
      return {
        id: '', // Not available locally
        name: entry.name,
        type: entry.isDirectory() ? 'dir' as const : 'file' as const,
        size: entry.isFile() ? stats.size : undefined,
        mtime: Math.floor(stats.mtimeMs / 1000),
      };
    }));
  } catch (err) {
    // Directory doesn't exist locally, fall back to API
    return null;
  }
}

const server = new McpServer({
  name: 'seafile',
  version: '1.0.0',
});

server.tool(
  'seafile_list_libraries',
  'List all Seafile libraries (repositories) accessible to the authenticated user',
  {},
  async () => {
    const libraries: SeafileLibrary[] = await seafileRequest('/api2/repos/');

    const formatted = libraries.map(lib =>
      `${lib.name} (${lib.id}) - ${lib.type} - ${(lib.size / 1024 / 1024).toFixed(2)} MB${lib.encrypted ? ' [encrypted]' : ''}`
    ).join('\n');

    return {
      content: [{
        type: 'text' as const,
        text: `Libraries:\n${formatted}\n\nTotal: ${libraries.length} libraries`
      }]
    };
  }
);

server.tool(
  'seafile_list_dir',
  'List contents of a directory in a Seafile library (uses local sync if available, otherwise API)',
  {
    library_id: z.string().describe('The library/repository ID'),
    path: z.string().default('/').describe('Directory path (default: /)'),
  },
  async (args) => {
    // Try local access first
    let entries: SeafileDirEntry[] | null = await tryListDirLocal(args.library_id, args.path);
    let source = 'local';

    // Fall back to API if local not available
    if (!entries) {
      const encodedPath = encodeURIComponent(args.path);
      entries = await seafileRequest(
        `/api2/repos/${args.library_id}/dir/?p=${encodedPath}`
      );
      source = 'api';
    }

    // TypeScript guard: entries should always be set at this point
    if (!entries) {
      throw new Error('Failed to list directory from both local and API sources');
    }

    const formatted = entries.map(entry => {
      const icon = entry.type === 'dir' ? '📁' : '📄';
      const size = entry.size ? ` (${(entry.size / 1024).toFixed(2)} KB)` : '';
      const mtime = entry.mtime ? ` [${new Date(entry.mtime * 1000).toISOString()}]` : '';
      return `${icon} ${entry.name}${size}${mtime}`;
    }).join('\n');

    return {
      content: [{
        type: 'text' as const,
        text: `Contents of ${args.path} [${source}]:\n${formatted}\n\nTotal: ${entries.length} items`
      }]
    };
  }
);

server.tool(
  'seafile_read_file',
  'Read the contents of a file from Seafile (uses local sync if available, otherwise API)',
  {
    library_id: z.string().describe('The library/repository ID'),
    path: z.string().describe('File path'),
    encoding: z
      .enum(['utf-8', 'base64'])
      .default('utf-8')
      .describe(
        "How to return the content. Use 'base64' for binary files (PDF, DOCX, images, audio); 'utf-8' text decoding corrupts non-text bytes.",
      ),
  },
  async (args) => {
    // Try local access first
    const localContent = await tryReadLocal(args.library_id, args.path, args.encoding);
    if (localContent !== null) {
      return {
        content: [{
          type: 'text' as const,
          text: `File: ${args.path} [local, ${args.encoding}]\n\n${localContent}`
        }]
      };
    }

    // Fall back to API
    const encodedPath = encodeURIComponent(args.path);
    const downloadUrl = await seafileRequest(
      `/api2/repos/${args.library_id}/file/?p=${encodedPath}`,
      { method: 'GET' }
    );

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    // Encode per request: base64 preserves exact bytes for binary files.
    const content =
      args.encoding === 'base64'
        ? Buffer.from(await response.arrayBuffer()).toString('base64')
        : await response.text();

    return {
      content: [{
        type: 'text' as const,
        text: `File: ${args.path} [api, ${args.encoding}]\n\n${content}`
      }]
    };
  }
);

server.tool(
  'seafile_upload_file',
  'Upload or update a file in Seafile',
  {
    library_id: z.string().describe('The library/repository ID'),
    path: z.string().describe('File path (must start with /)'),
    content: z.string().describe('File content — plain text, or base64-encoded bytes when encoding=base64'),
    encoding: z
      .enum(['utf-8', 'base64'])
      .default('utf-8')
      .describe("Set 'base64' to upload binary content (PDF, DOCX, images, audio) byte-for-byte."),
    replace: z.boolean().default(false).describe('Replace existing file if it exists'),
  },
  async (args) => {
    const parentDir = args.path.substring(0, args.path.lastIndexOf('/')) || '/';

    // Ensure the parent directory (and any missing intermediates) exists. Seafile
    // won't create intermediate dirs on upload; a failure here is surfaced rather
    // than swallowed, so it can't resurface later as a confusing upload 404.
    await ensureDir(args.library_id, parentDir);

    // Get upload link scoped to the parent directory (required for subdirectory uploads)
    const encodedParent = encodeURIComponent(parentDir);
    const uploadUrl = await seafileRequest(
      `/api2/repos/${args.library_id}/upload-link/?p=${encodedParent}`,
      { method: 'GET' }
    );

    // Prepare multipart form data. base64 content is decoded to raw bytes and
    // given a best-effort mimetype so binary files upload intact.
    const formData = new FormData();
    const filename = args.path.split('/').pop() || 'file';
    const blob =
      args.encoding === 'base64'
        ? new Blob([Buffer.from(args.content, 'base64')], { type: guessMime(filename) })
        : new Blob([args.content], { type: 'text/plain' });
    formData.append('file', blob, filename);
    formData.append('parent_dir', parentDir);
    if (args.replace) {
      formData.append('replace', '1');
    }

    // Upload file
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${SEAFILE_TOKEN}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed (${response.status}): ${errorText}`);
    }

    const result = await response.text();

    return {
      content: [{
        type: 'text' as const,
        text: `File uploaded successfully: ${args.path}\n${result}`
      }]
    };
  }
);

server.tool(
  'seafile_create_dir',
  'Create a new directory in Seafile (creates missing parent directories too)',
  {
    library_id: z.string().describe('The library/repository ID'),
    path: z.string().describe('Directory path to create'),
  },
  async (args) => {
    // Recursive + idempotent + form-encoded mkdir (calcifer-225e).
    await ensureDir(args.library_id, args.path);

    return {
      content: [{
        type: 'text' as const,
        text: `Directory created: ${args.path}`
      }]
    };
  }
);

server.tool(
  'seafile_delete',
  'Delete a file or directory from Seafile',
  {
    library_id: z.string().describe('The library/repository ID'),
    path: z.string().describe('File or directory path to delete'),
  },
  async (args) => {
    const encodedPath = encodeURIComponent(args.path);
    await seafileRequest(
      `/api2/repos/${args.library_id}/file/?p=${encodedPath}`,
      { method: 'DELETE' }
    );

    return {
      content: [{
        type: 'text' as const,
        text: `Deleted: ${args.path}`
      }]
    };
  }
);

server.tool(
  'seafile_move',
  'Move a file or directory into a destination directory, optionally in another library. Keeps the original filename (this moves into dst_dir; it does not rename).',
  {
    library_id: z.string().describe('The source library/repository ID'),
    src_path: z.string().describe('Source path'),
    dst_path: z.string().describe('Destination path (its parent directory is the target directory)'),
    dst_library_id: z
      .string()
      .optional()
      .describe('Destination library ID for cross-library moves (default: same as library_id)'),
    is_dir: z.boolean().default(false).describe('Set true when moving a directory (uses the dir endpoint)'),
  },
  async (args) => {
    const dstRepo = args.dst_library_id || args.library_id;
    const dstDir = args.dst_path.substring(0, args.dst_path.lastIndexOf('/')) || '/';
    await ensureDir(dstRepo, dstDir);
    if (args.is_dir) {
      // api2 /dir/ only supports mkdir/rename — directory (and cross-library)
      // moves go through the v2.1 batch endpoint (calcifer-9e4c).
      await seafileBatchItemOp('move', args.library_id, args.src_path, dstRepo, dstDir);
    } else {
      // Files: api2 /file/ move with a distinct dst_repo (form-encoded), the
      // path calcifer-225e verified.
      await seafilePostForm(`/api2/repos/${args.library_id}/file/?p=${encodeURIComponent(args.src_path)}`, {
        operation: 'move',
        dst_repo: dstRepo,
        dst_dir: dstDir,
      });
    }

    const crossLib = dstRepo !== args.library_id ? ` in library ${dstRepo}` : '';
    return {
      content: [{
        type: 'text' as const,
        text: `Moved ${args.src_path} to ${dstDir}${crossLib}`
      }]
    };
  }
);

server.tool(
  'seafile_copy',
  'Copy a file or directory into a destination directory, optionally in another library. Useful to verify a cross-library relocation succeeded before deleting the source.',
  {
    library_id: z.string().describe('The source library/repository ID'),
    src_path: z.string().describe('Source path'),
    dst_path: z.string().describe('Destination path (its parent directory is the target directory)'),
    dst_library_id: z
      .string()
      .optional()
      .describe('Destination library ID for cross-library copies (default: same as library_id)'),
    is_dir: z.boolean().default(false).describe('Set true when copying a directory'),
  },
  async (args) => {
    const dstRepo = args.dst_library_id || args.library_id;
    const dstDir = args.dst_path.substring(0, args.dst_path.lastIndexOf('/')) || '/';
    await ensureDir(dstRepo, dstDir);
    if (args.is_dir) {
      // Directory copy — v2.1 batch endpoint (calcifer-9e4c).
      await seafileBatchItemOp('copy', args.library_id, args.src_path, dstRepo, dstDir);
    } else {
      await seafilePostForm(`/api2/repos/${args.library_id}/file/?p=${encodeURIComponent(args.src_path)}`, {
        operation: 'copy',
        dst_repo: dstRepo,
        dst_dir: dstDir,
      });
    }

    const crossLib = dstRepo !== args.library_id ? ` in library ${dstRepo}` : '';
    return {
      content: [{
        type: 'text' as const,
        text: `Copied ${args.src_path} to ${dstDir}${crossLib}`
      }]
    };
  }
);

server.tool(
  'seafile_search',
  'Search for files and directories in Seafile',
  {
    query: z.string().describe('Search query'),
    library_id: z.string().optional().describe('Optional: limit search to specific library'),
  },
  async (args) => {
    const params = new URLSearchParams({ q: args.query });
    if (args.library_id) {
      params.append('repo_id', args.library_id);
    }

    const results = await seafileRequest(`/api2/search/?${params.toString()}`);

    const formatted = results.results?.map((r: any) =>
      `${r.is_dir ? '📁' : '📄'} ${r.name} - ${r.repo_name}:${r.fullpath}`
    ).join('\n') || 'No results found';

    return {
      content: [{
        type: 'text' as const,
        text: `Search results for "${args.query}":\n${formatted}\n\nTotal: ${results.total || 0} results`
      }]
    };
  }
);

server.tool(
  'seafile_create_share_link',
  'Create a shareable download link for a file in Seafile. Returns a URL that can be shared with others.',
  {
    library_id: z.string().describe('The library/repository ID'),
    path: z.string().describe('File path'),
    password: z.string().optional().describe('Optional password to protect the link'),
    expire_days: z.number().int().min(1).optional().describe('Number of days until link expires'),
  },
  async (args) => {
    const payload: any = {
      repo_id: args.library_id,
      path: args.path,
      permissions: {
        can_edit: false,
        can_download: true,
      },
    };

    if (args.password) {
      payload.password = args.password;
    }

    if (args.expire_days) {
      payload.expire_days = args.expire_days;
    }

    const response = await seafileRequest(
      '/api/v2.1/share-links/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const link = response.link || '';
    const token = response.token || '';
    const expirationDate = response.expire_date ? new Date(response.expire_date).toLocaleDateString() : 'Never';

    // Append ?dl=1 to get direct download link instead of share page
    const downloadLink = link ? `${link}?dl=1` : '';

    let result = `Share link created for ${args.path}:\n\n`;
    result += `🔗 ${downloadLink}\n\n`;
    result += `Token: ${token}\n`;
    result += `Expires: ${expirationDate}\n`;
    if (args.password) {
      result += `Password protected: Yes\n`;
    }
    result += `\nAnyone with this link can download the file.`;

    return {
      content: [{
        type: 'text' as const,
        text: result
      }]
    };
  }
);

// Only start the stdio server when run directly (bun /app/src/seafile-mcp-stdio.ts).
// When imported (e.g. by the calcifer-9e4c regression test), skip startup so the
// helpers can be exercised in isolation.
if ((import.meta as { main?: boolean }).main) {
  const transport = new StdioServerTransport();
  server.connect(transport);
}

export { seafileRequest, seafilePostForm, ensureDir, seafileBatchItemOp, SEAFILE_URL, SEAFILE_TOKEN };
