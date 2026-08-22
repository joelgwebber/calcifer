import type { Migration } from './index.js';

/**
 * Web UI auth (calcifer-7c3a.6). One credential row per web user. The nanoclaw
 * identity itself lives in `users` (id `web:<handle>`); this table only holds
 * the secret needed to authenticate a browser session as that user.
 *
 * pw_hash format: `scrypt$<saltHex>$<derivedKeyHex>` — self-describing so the
 * verifier needs no out-of-band parameters. No plaintext is ever stored.
 *
 * NOTE: renumbered from 016 → 024 during the v2.2.0 upstream merge (upstream
 * took 016–023). The applied identity is `name` ('web-credentials'), which is
 * unchanged, so already-migrated DBs are unaffected; only the file/symbol
 * number moved to avoid colliding with upstream's 016.
 */
export const migration024: Migration = {
  version: 24,
  name: 'web-credentials',
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS web_credentials (
        user_id     TEXT PRIMARY KEY REFERENCES users(id),
        pw_hash     TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
    `);
  },
};
