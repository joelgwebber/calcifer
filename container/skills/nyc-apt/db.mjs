/**
 * Listings database — tracks all found apartments across all sources.
 * SQLite via better-sqlite3. Single file under the per-install data dir.
 *
 * The native better-sqlite3 binding and the DB file both live in the writable
 * data dir ($NYC_APT_DIR, default /workspace/agent/nyc-apt) — never in the
 * read-only skill mount. See SKILL.md "Setup".
 */

import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const DATA_DIR = process.env.NYC_APT_DIR ?? '/workspace/agent/nyc-apt';
const DB_PATH = path.join(DATA_DIR, 'listings.db');
const Database = require(path.join(DATA_DIR, 'node_modules', 'better-sqlite3'));

let _db;
function db() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      external_id TEXT,
      address TEXT,
      neighborhood TEXT,
      price INTEGER,
      beds INTEGER,
      baths REAL,
      available_at TEXT,
      url TEXT,
      broker TEXT,
      broker_agent TEXT,
      source_type TEXT,
      no_fee INTEGER DEFAULT 0,
      months_free INTEGER DEFAULT 0,
      net_effective_price INTEGER,
      building_type TEXT,
      -- dedup key: normalized address for cross-source matching
      canonical_address TEXT,
      -- lifecycle
      first_seen_at TEXT NOT NULL,
      first_seen_source TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      starred INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sightings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id TEXT NOT NULL REFERENCES listings(id),
      source TEXT NOT NULL,
      seen_at TEXT NOT NULL,
      price INTEGER,
      raw_data TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_listings_status    ON listings(status);
    CREATE INDEX IF NOT EXISTS idx_listings_source    ON listings(source);
    CREATE INDEX IF NOT EXISTS idx_listings_canonical ON listings(canonical_address);
    CREATE INDEX IF NOT EXISTS idx_listings_first_seen ON listings(first_seen_at);
    CREATE INDEX IF NOT EXISTS idx_sightings_listing  ON sightings(listing_id);
  `);
}

/** Normalize an address string for cross-source dedup matching. */
function canonicalize(address) {
  if (!address) return null;
  return address
    .toLowerCase()
    .replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd').replace(/\bplace\b/g, 'pl')
    .replace(/\bdrive\b/g, 'dr').replace(/\broad\b/g, 'rd')
    .replace(/\bwest\b/g, 'w').replace(/\beast\b/g, 'e')
    .replace(/\bnorth\b/g, 'n').replace(/\bsouth\b/g, 's')
    .replace(/\bapartment\b|\bapt\b/g, '#')
    .replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Upsert a listing. Returns { isNew: bool, listing }.
 * If the same canonical address already exists from another source,
 * records a cross-source sighting but does NOT create a duplicate row.
 */
export function upsertListing(raw) {
  const d = db();
  const now = new Date().toISOString();
  const canonical = canonicalize(raw.address);

  // Check for existing listing by primary ID
  const existing = d.prepare('SELECT * FROM listings WHERE id = ?').get(raw.id);
  if (existing) {
    // Update last_seen and price if changed
    d.prepare(`UPDATE listings SET last_seen_at = ?, price = ?, updated_at = ? WHERE id = ?`)
      .run(now, raw.price ?? existing.price, now, raw.id);
    recordSighting(raw.id, raw, now);
    return { isNew: false, listing: existing };
  }

  // Check for cross-source match by canonical address + beds
  let crossMatch = null;
  if (canonical) {
    crossMatch = d.prepare(
      "SELECT * FROM listings WHERE canonical_address = ? AND beds = ? AND status = 'active' LIMIT 1"
    ).get(canonical, raw.beds ?? null);
  }

  const listing = {
    id: raw.id,
    source: raw.source,
    external_id: raw.externalId ?? raw.id,
    address: raw.address ?? null,
    neighborhood: raw.neighborhood ?? null,
    price: raw.price ?? null,
    beds: raw.beds ?? null,
    baths: raw.baths ?? null,
    available_at: raw.availableAt ?? null,
    url: raw.url ?? null,
    broker: raw.broker ?? null,
    broker_agent: raw.brokerAgent ?? null,
    source_type: raw.sourceType ?? null,
    no_fee: raw.noFee ? 1 : 0,
    months_free: raw.monthsFree ?? 0,
    net_effective_price: raw.netEffectivePrice ?? null,
    building_type: raw.buildingType ?? null,
    canonical_address: canonical,
    first_seen_at: now,
    first_seen_source: raw.source,
    last_seen_at: now,
    status: 'active',
    starred: 0,
    notes: crossMatch ? `Also seen as ${crossMatch.id} (${crossMatch.source})` : null,
  };

  d.prepare(`INSERT INTO listings
    (id, source, external_id, address, neighborhood, price, beds, baths,
     available_at, url, broker, broker_agent, source_type, no_fee, months_free,
     net_effective_price, building_type, canonical_address, first_seen_at,
     first_seen_source, last_seen_at, status, starred, notes)
    VALUES
    (@id, @source, @external_id, @address, @neighborhood, @price, @beds, @baths,
     @available_at, @url, @broker, @broker_agent, @source_type, @no_fee, @months_free,
     @net_effective_price, @building_type, @canonical_address, @first_seen_at,
     @first_seen_source, @last_seen_at, @status, @starred, @notes)`).run(listing);

  recordSighting(raw.id, raw, now);

  if (crossMatch) {
    // Also record a sighting on the cross-matched listing so we know this source saw it
    recordSighting(crossMatch.id, { ...raw, source: raw.source + '_xref' }, now);
  }

  return { isNew: !crossMatch, listing, crossMatch };
}

function recordSighting(listingId, raw, now) {
  db().prepare(`INSERT INTO sightings (listing_id, source, seen_at, price, raw_data)
    VALUES (?, ?, ?, ?, ?)`)
    .run(listingId, raw.source, now, raw.price ?? null, JSON.stringify(raw));
}

/** Mark listings not seen in recent check as potentially gone. */
export function markStale(source, seenIds, cutoffMinutes = 60) {
  const d = db();
  const cutoff = new Date(Date.now() - cutoffMinutes * 60 * 1000).toISOString();
  d.prepare(`
    UPDATE listings
    SET status = 'gone', updated_at = datetime('now')
    WHERE source = ? AND status = 'active' AND last_seen_at < ? AND id NOT IN (${seenIds.map(() => '?').join(',') || "''"})
  `).run(source, cutoff, ...seenIds);
}

/** Return all active starred listings for follow-up. */
export function getStarred() {
  return db().prepare("SELECT * FROM listings WHERE starred = 1 AND status = 'active' ORDER BY first_seen_at DESC").all();
}

/** Return recent new listings (last N hours). */
export function getRecent(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  return db().prepare("SELECT * FROM listings WHERE first_seen_at > ? ORDER BY first_seen_at DESC").all(cutoff);
}

/** Star/unstar a listing by ID fragment or URL. */
export function starListing(idOrUrl, notes = null) {
  const d = db();
  const row = d.prepare("SELECT id FROM listings WHERE id LIKE ? OR url LIKE ? LIMIT 1")
    .get(`%${idOrUrl}%`, `%${idOrUrl}%`);
  if (!row) return false;
  d.prepare("UPDATE listings SET starred = 1, notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?")
    .run(notes, row.id);
  return row.id;
}

/** Update status (active/gone/touring/applied/passed) and optional note. */
export function setStatus(idOrUrl, status, notes = null) {
  const d = db();
  const row = d.prepare("SELECT id FROM listings WHERE id LIKE ? OR url LIKE ? LIMIT 1")
    .get(`%${idOrUrl}%`, `%${idOrUrl}%`);
  if (!row) return false;
  d.prepare("UPDATE listings SET status = ?, notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?")
    .run(status, notes, row.id);
  return row.id;
}
