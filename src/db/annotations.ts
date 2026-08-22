/**
 * Shared (family-wide) annotations for skill-view entities (calcifer-1d51.1).
 *
 * See migration 025-annotations. Host-owned UI state — stars, notes, read-state
 * — keyed by (skill, entity_id, key), not by user. Reads merge into the view
 * data plane; writes come from the web `POST /api/annotations` endpoint.
 */
import { getDb } from './connection.js';

export interface Annotation {
  skill: string;
  entity_id: string;
  key: string;
  value: string;
}

/** Set (upsert) an annotation. */
export async function setAnnotation(skill: string, entityId: string, key: string, value: string): Promise<void> {
  await getDb().run(
    `INSERT INTO annotations (skill, entity_id, key, value, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(skill, entity_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    skill,
    entityId,
    key,
    value,
    new Date().toISOString(),
  );
}

/** Remove an annotation (e.g. unstar). */
export async function clearAnnotation(skill: string, entityId: string, key: string): Promise<void> {
  await getDb().run('DELETE FROM annotations WHERE skill = ? AND entity_id = ? AND key = ?', skill, entityId, key);
}

/**
 * Fetch annotations for a set of entities, grouped by entity_id:
 *   { "<entity_id>": { star: "true", note: "..." } }
 * Entities with no annotations are simply absent from the map.
 */
export async function getAnnotationsFor(
  skill: string,
  entityIds: string[],
): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>();
  if (entityIds.length === 0) return out;
  const placeholders = entityIds.map(() => '?').join(',');
  const rows = await getDb().all<{ entity_id: string; key: string; value: string }>(
    `SELECT entity_id, key, value FROM annotations WHERE skill = ? AND entity_id IN (${placeholders})`,
    skill,
    ...entityIds,
  );
  for (const r of rows) {
    const rec = out.get(r.entity_id) ?? {};
    rec[r.key] = r.value;
    out.set(r.entity_id, rec);
  }
  return out;
}

/** Entity ids that have any annotation for the given key (e.g. all starred). */
export async function getEntityIdsWithAnnotation(skill: string, key: string): Promise<string[]> {
  const rows = await getDb().all<{ entity_id: string }>(
    'SELECT entity_id FROM annotations WHERE skill = ? AND key = ?',
    skill,
    key,
  );
  return rows.map((r) => r.entity_id);
}
