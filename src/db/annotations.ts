/**
 * Shared (family-wide) annotations for skill-view entities (calcifer-1d51.1).
 *
 * See migration 017. Host-owned UI state — stars, notes, read-state — keyed by
 * (skill, entity_id, key), not by user. Reads merge into the view data plane;
 * writes come from the web `POST /api/annotations` endpoint.
 */
import { getDb } from './connection.js';

export interface Annotation {
  skill: string;
  entity_id: string;
  key: string;
  value: string;
}

/** Set (upsert) an annotation. */
export function setAnnotation(skill: string, entityId: string, key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO annotations (skill, entity_id, key, value, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(skill, entity_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(skill, entityId, key, value);
}

/** Remove an annotation (e.g. unstar). */
export function clearAnnotation(skill: string, entityId: string, key: string): void {
  getDb().prepare('DELETE FROM annotations WHERE skill = ? AND entity_id = ? AND key = ?').run(skill, entityId, key);
}

/**
 * Fetch annotations for a set of entities, grouped by entity_id:
 *   { "<entity_id>": { star: "true", note: "..." } }
 * Entities with no annotations are simply absent from the map.
 */
export function getAnnotationsFor(skill: string, entityIds: string[]): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  if (entityIds.length === 0) return out;
  const placeholders = entityIds.map(() => '?').join(',');
  const rows = getDb()
    .prepare(`SELECT entity_id, key, value FROM annotations WHERE skill = ? AND entity_id IN (${placeholders})`)
    .all(skill, ...entityIds) as Array<{ entity_id: string; key: string; value: string }>;
  for (const r of rows) {
    const rec = out.get(r.entity_id) ?? {};
    rec[r.key] = r.value;
    out.set(r.entity_id, rec);
  }
  return out;
}

/** Entity ids that have any annotation for the given key (e.g. all starred). */
export function getEntityIdsWithAnnotation(skill: string, key: string): string[] {
  return (
    getDb().prepare('SELECT entity_id FROM annotations WHERE skill = ? AND key = ?').all(skill, key) as Array<{
      entity_id: string;
    }>
  ).map((r) => r.entity_id);
}
