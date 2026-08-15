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
