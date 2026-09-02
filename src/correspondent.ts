/**
 * Thread correspondents — who a web thread is a conversation *with*.
 *
 * A durable per-correspondent web thread (calcifer-226a) encodes its
 * correspondent directly in the per-thread session's thread_id, so the thread_id
 * is the single source of truth — no separate column, no lazily-written metadata
 * row to fall out of sync:
 *
 *   peer:<agentGroupId>  — a peer-agent relay thread (e.g. "from Joel"): the
 *                          surfacing runs in the recipient's web session and its
 *                          replies route back to that peer's agent group.
 *   sys:<source>         — an own-agent / system notification thread (e.g.
 *                          "Reminders"): unbidden pushes with no external peer.
 *
 * Ordinary user chats use client-generated thread_ids and have NO correspondent
 * (parseCorrespondent → null).
 *
 * Consumers: calcifer-bd2f renders the UI label from the correspondent;
 * calcifer-2279 routes a reply typed in the thread back to the correspondent via
 * the agent-to-agent return path. Keep the grammar here so both agree.
 */
export const PEER_THREAD_PREFIX = 'peer:';
export const SYSTEM_THREAD_PREFIX = 'sys:';

export type CorrespondentKind = 'agent' | 'system';

export interface Correspondent {
  kind: CorrespondentKind;
  /** For 'agent': the peer agent group id. For 'system': the source label. */
  ref: string;
}

/** Deterministic thread_id for a per-correspondent thread with a peer agent. */
export function peerThreadId(agentGroupId: string): string {
  return `${PEER_THREAD_PREFIX}${agentGroupId}`;
}

/** Deterministic thread_id for an own-agent / system notification thread. */
export function systemThreadId(source: string): string {
  return `${SYSTEM_THREAD_PREFIX}${source}`;
}

/**
 * Parse a thread_id into its correspondent, or null for an ordinary user chat.
 * A bare prefix with no ref (`peer:`) is not a correspondent.
 */
export function parseCorrespondent(threadId: string | null | undefined): Correspondent | null {
  if (!threadId) return null;
  if (threadId.startsWith(PEER_THREAD_PREFIX)) {
    const ref = threadId.slice(PEER_THREAD_PREFIX.length);
    return ref ? { kind: 'agent', ref } : null;
  }
  if (threadId.startsWith(SYSTEM_THREAD_PREFIX)) {
    const ref = threadId.slice(SYSTEM_THREAD_PREFIX.length);
    return ref ? { kind: 'system', ref } : null;
  }
  return null;
}
