/**
 * Conversation (thread) metadata API — rename, archive/rescue, and the archived
 * list (calcifer-3236 / web overhaul B0). Cookies are same-origin; no tokens in
 * JS. The rename/archive endpoints persist to the host's thread_meta table so a
 * renamed/archived conversation survives reload (and is shared family-wide).
 */

export interface ArchivedThread {
  threadId: string;
  title: string;
  /** Epoch milliseconds (UTC). */
  lastActive: number;
  pinned?: boolean;
}

/** Persist a title override (null/empty clears it → first-message fallback). */
export async function renameThread(threadId: string, title: string | null): Promise<boolean> {
  try {
    const res = await fetch('/api/threads/rename', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, title }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Archive (archived=true) or rescue (archived=false) a conversation. */
export async function archiveThread(threadId: string, archived: boolean): Promise<boolean> {
  try {
    const res = await fetch('/api/threads/archive', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, archived }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** The archived conversations, optionally filtered by a case-insensitive title substring. */
export async function fetchArchivedThreads(query?: string): Promise<ArchivedThread[]> {
  try {
    const url = query ? `/api/threads/archived?q=${encodeURIComponent(query)}` : '/api/threads/archived';
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return [];
    const data = (await res.json()) as { threads?: ArchivedThread[] };
    return data.threads ?? [];
  } catch {
    return [];
  }
}
