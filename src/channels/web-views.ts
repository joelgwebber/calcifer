/**
 * Web glue for skill views (calcifer-1d51.3/.4).
 *
 * Ties the manifest registry + data-plane engine + shared annotations to the
 * authenticated web user. A view's data is read from the user's OWN agent-group
 * workspace (user -> their web messaging group -> wiring -> agent group), so
 * every family member sees their agent's fact store, scoped by the same auth
 * that gates the rest of the web channel.
 */
import { clearAnnotation, setAnnotation } from '../db/annotations.js';
import { normalizeCard, type WebCard } from './web-cards.js';
import { getAgentGroup } from '../db/agent-groups.js';
import { getMessagingGroupAgents, getMessagingGroupByPlatform } from '../db/messaging-groups.js';
import {
  getViewRecord,
  queryView,
  readViewFile,
  ViewDataError,
  type QueryParams,
  type QueryResult,
  type ViewFile,
} from '../views/data-plane.js';
import { getView, listViewSummaries, type ViewManifest, type ViewSummary } from '../views/manifest.js';

export { ViewDataError };

/** Full manifest for a view — safe to hand to the client (declarative UI config, no secrets). */
export function getManifestForClient(viewName: string): ViewManifest {
  const m = getView(viewName);
  if (!m) throw new ViewDataError(404, `unknown view: ${viewName}`);
  return m;
}

/** userId (web:<handle>) -> the folder of the agent group they're wired to. */
function resolveAgentGroupFolder(userId: string): string | null {
  const mg = getMessagingGroupByPlatform('web', userId);
  if (!mg) return null;
  const agents = getMessagingGroupAgents(mg.id);
  if (agents.length === 0) return null;
  const ag = getAgentGroup(agents[0].agent_group_id);
  return ag?.folder ?? null;
}

export function listViews(): ViewSummary[] {
  return listViewSummaries();
}

export function queryViewForUser(userId: string, viewName: string, params: QueryParams): QueryResult {
  const manifest = getView(viewName);
  if (!manifest) throw new ViewDataError(404, `unknown view: ${viewName}`);
  const folder = resolveAgentGroupFolder(userId);
  if (!folder) throw new ViewDataError(404, 'no agent group for this user');
  return queryView(manifest, folder, params);
}

export function recordForUser(userId: string, viewName: string, id: string): Record<string, unknown> | null {
  const manifest = getView(viewName);
  if (!manifest) throw new ViewDataError(404, `unknown view: ${viewName}`);
  const folder = resolveAgentGroupFolder(userId);
  if (!folder) throw new ViewDataError(404, 'no agent group for this user');
  return getViewRecord(manifest, folder, id);
}

/** Resolve a raw file (bytes) for an fs-backed view, scoped by the same auth. */
export function fileForUser(userId: string, viewName: string, id: string): ViewFile | null {
  const manifest = getView(viewName);
  if (!manifest) throw new ViewDataError(404, `unknown view: ${viewName}`);
  const folder = resolveAgentGroupFolder(userId);
  if (!folder) throw new ViewDataError(404, 'no agent group for this user');
  return readViewFile(manifest, folder, id);
}

// ─── record cards (calcifer-2588) ──────────────────────────────────────────

const CARD_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

/** Minimal {field} interpolation over a record (mirrors the frontend primitive). */
function interpolate(template: string, row: Record<string, unknown>): string {
  return template.replace(/\{([a-z0-9_]+)\}/gi, (_, k: string) => {
    const v = row[k];
    return v === null || v === undefined ? '' : String(v);
  });
}

/**
 * Resolve a (view, id) reference into the manifest's card projection with live
 * annotation state — the same card the list renders, destined for the chat
 * context. Works for fs + shared sqlite views (folder-scoped agent sources are
 * not supported as card refs yet).
 */
export function resolveRecordCard(viewName: string, id: string): WebCard | null {
  const manifest = getView(viewName);
  if (!manifest) return null;
  let record: Record<string, unknown> | null;
  try {
    record = getViewRecord(manifest, '', id);
  } catch {
    return null;
  }
  if (!record) return null;

  const card = manifest.list?.card;
  const title = card?.title ? interpolate(card.title, record) : String(record.title ?? record.name ?? id);
  const subtitle = card?.subtitle ? interpolate(card.subtitle, record).trim() || undefined : undefined;
  const badges = (card?.badges ?? []).map((b) => interpolate(b.label, record).trim()).filter(Boolean);
  const ann = (record._ann as Record<string, string> | undefined) ?? {};

  let thumbnail: string | undefined;
  const ext = String(record.ext ?? '').toLowerCase();
  if (manifest.data.type === 'fs' && CARD_IMAGE_EXTS.has(ext)) {
    thumbnail = `/api/views/${encodeURIComponent(viewName)}/thumb/${encodeURIComponent(id)}?w=200`;
  } else if (card?.thumbnail) {
    thumbnail = interpolate(card.thumbnail, record).trim() || undefined;
  }

  return {
    title: title.trim() || undefined,
    record: {
      view: viewName,
      id,
      starred: ann.star === 'true',
      subtitle,
      thumbnail,
      badges: badges.length ? badges : undefined,
    },
    actions: [{ label: 'Open', url: `/app/${encodeURIComponent(viewName)}/${encodeURIComponent(id)}` }],
  };
}

/**
 * Turn an outbound card content blob into a renderable WebCard. A `record_card`
 * is resolved live against the data plane; anything else is a hand-authored
 * `send_card` normalized as before. Single entry point for delivery + history.
 */
export function cardFromContent(content: unknown): WebCard | null {
  if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>;
    if (c.type === 'record_card' && typeof c.view === 'string' && typeof c.id === 'string') {
      const resolved = resolveRecordCard(c.view, c.id);
      if (resolved && typeof c.fallbackText === 'string' && c.fallbackText) resolved.fallbackText = c.fallbackText;
      return resolved;
    }
  }
  return normalizeCard(content);
}

/** Set (value != null) or clear (value == null) a shared annotation for a view entity. */
export function annotateForUser(viewName: string, entityId: string, key: string, value: string | null): void {
  const manifest = getView(viewName);
  if (!manifest) throw new ViewDataError(404, `unknown view: ${viewName}`);
  if (!entityId || !key) throw new ViewDataError(400, 'entity_id and key required');
  if (manifest.annotations && !manifest.annotations.includes(key)) {
    throw new ViewDataError(400, `annotation key not declared by view: ${key}`);
  }
  if (value === null) clearAnnotation(manifest.skill, entityId, key);
  else setAnnotation(manifest.skill, entityId, key, value);
}
