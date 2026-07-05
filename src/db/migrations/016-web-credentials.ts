import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

/**
 * Web UI auth (calcifer-7c3a.6). One credential row per web user. The nanoclaw
 * identity itself lives in `users` (id `web:<handle>`); this table only holds
 * the secret needed to authenticate a browser session as that user.
 *
 * pw_hash format: `scrypt$<saltHex>$<derivedKeyHex>` — self-describing so the
 * verifier needs no out-of-band parameters. No plaintext is ever stored.
 */
export const migration016: Migration = {
  version: 16,
  name: 'web-credentials',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE web_credentials (
        user_id     TEXT PRIMARY KEY REFERENCES users(id),
        pw_hash     TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
    `);
  },
};
