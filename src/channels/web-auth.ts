/**
 * Web UI authentication (calcifer-7c3a.6) — zero new dependencies.
 *
 * Everything here is built on Node's built-in `crypto`, matching the web
 * channel's zero-dep ethos and sidestepping the supply-chain release-age gate:
 *
 *   - Passwords:  scrypt with a per-user random salt, timing-safe verify.
 *   - Sessions:   stateless HMAC-SHA256-signed tokens carried in an HttpOnly
 *                 cookie. No server-side session table to grow or sweep;
 *                 expiry is baked into the signed payload.
 *   - Secret:     a 32-byte random key persisted at data/web-auth-secret
 *                 (0600), generated on first use. Rotating it invalidates all
 *                 outstanding sessions (the only "log everyone out" lever).
 *
 * Security posture for open-web exposure:
 *   - Owner-provisioned accounts only (scripts/web-user.ts). No open signup.
 *   - Login is rate-limited per handle to blunt brute force.
 *   - Cookie is HttpOnly + SameSite=Lax; Secure is enabled via
 *     WEB_UI_SECURE_COOKIE=true when the UI sits behind TLS. Exposing the port
 *     to the open internet REQUIRES TLS termination + that flag.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { DATA_DIR } from '../config.js';
import { getDb } from '../db/connection.js';
import { getUser } from '../modules/permissions/db/users.js';

export const SESSION_COOKIE = 'nc_web_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SCRYPT_KEYLEN = 32;
const SECRET_PATH = path.join(DATA_DIR, 'web-auth-secret');

// ─── config ───────────────────────────────────────────────────────────────

/** Whether the web channel enforces auth. Secure by default; opt out for local dev. */
export function requireAuth(): boolean {
  return process.env.WEB_UI_REQUIRE_AUTH !== 'false';
}

/** Set the cookie's Secure flag. Required (true) when serving over TLS. */
export function secureCookie(): boolean {
  return process.env.WEB_UI_SECURE_COOKIE === 'true';
}

// ─── server secret ──────────────────────────────────────────────────────────

let cachedSecret: Buffer | null = null;

function getSecret(): Buffer {
  if (cachedSecret) return cachedSecret;
  try {
    const hex = fs.readFileSync(SECRET_PATH, 'utf8').trim();
    if (hex.length >= 32) {
      cachedSecret = Buffer.from(hex, 'hex');
      return cachedSecret;
    }
  } catch {
    // Missing — generate below.
  }
  const secret = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(SECRET_PATH), { recursive: true });
  fs.writeFileSync(SECRET_PATH, secret.toString('hex'), { mode: 0o600 });
  cachedSecret = secret;
  return secret;
}

// ─── password hashing ───────────────────────────────────────────────────────

/** Hash a password with scrypt. Returns `scrypt$<saltHex>$<keyHex>`. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Verify a password against a stored `scrypt$salt$key` hash (timing-safe). */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  let derived: Buffer;
  try {
    derived = crypto.scryptSync(password, salt, expected.length);
  } catch {
    return false;
  }
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

// ─── session tokens ─────────────────────────────────────────────────────────

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

interface SessionPayload {
  sub: string; // user id, e.g. web:joel
  exp: number; // epoch ms
}

/** Mint a signed session token for a user. */
export function issueSession(userId: string): string {
  const payload: SessionPayload = { sub: userId, exp: Date.now() + SESSION_TTL_MS };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** Verify a session token; returns the user id if valid and unexpired. */
export function verifySession(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  // Timing-safe compare on equal-length buffers.
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (Date.now() >= payload.exp) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

// ─── cookies ────────────────────────────────────────────────────────────────

/** Parse a Cookie header into a name→value map. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

/** Build a Set-Cookie value for the session cookie (or a clearing one). */
export function sessionCookieHeader(token: string | null): string {
  const attrs = [`Path=/`, `HttpOnly`, `SameSite=Lax`];
  if (secureCookie()) attrs.push('Secure');
  if (token === null) {
    return `${SESSION_COOKIE}=; ${attrs.join('; ')}; Max-Age=0`;
  }
  return `${SESSION_COOKIE}=${token}; ${attrs.join('; ')}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

// ─── credentials store ──────────────────────────────────────────────────────

interface CredentialRow {
  user_id: string;
  pw_hash: string;
}

export async function getCredential(userId: string): Promise<CredentialRow | undefined> {
  return getDb().get<CredentialRow>('SELECT user_id, pw_hash FROM web_credentials WHERE user_id = ?', userId);
}

export async function upsertCredential(userId: string, pwHash: string): Promise<void> {
  const now = new Date().toISOString();
  await getDb().run(
    `INSERT INTO web_credentials (user_id, pw_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET pw_hash = excluded.pw_hash, updated_at = excluded.updated_at`,
    userId,
    pwHash,
    now,
    now,
  );
}

export async function deleteCredential(userId: string): Promise<void> {
  await getDb().run('DELETE FROM web_credentials WHERE user_id = ?', userId);
}

// ─── login rate limiting (in-memory, per handle) ────────────────────────────

const MAX_FAILURES = 8;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes
const failures = new Map<string, { count: number; until: number }>();

export function isLockedOut(handleKey: string): boolean {
  const rec = failures.get(handleKey);
  if (!rec) return false;
  if (Date.now() >= rec.until) {
    failures.delete(handleKey);
    return false;
  }
  return rec.count >= MAX_FAILURES;
}

export function recordFailure(handleKey: string): void {
  const rec = failures.get(handleKey) ?? { count: 0, until: 0 };
  rec.count += 1;
  rec.until = Date.now() + LOCKOUT_MS;
  failures.set(handleKey, rec);
}

export function clearFailures(handleKey: string): void {
  failures.delete(handleKey);
}

// ─── request authentication ─────────────────────────────────────────────────

export interface AuthedUser {
  /** nanoclaw user id, e.g. `web:joel`. Doubles as the routing platform_id. */
  userId: string;
  /** Display name from the users row, if set. */
  displayName: string | null;
  /** The bare handle (`joel`), i.e. userId without the `web:` prefix. */
  handle: string;
}

/**
 * Authenticate an inbound request from its session cookie. Returns null when
 * unauthenticated OR when the signed user no longer exists (revoked). The
 * user's id doubles as its per-user messaging-group platform_id, so callers
 * route/scope everything off `userId`.
 */
export async function authenticateRequest(cookieHeader: string | undefined): Promise<AuthedUser | null> {
  const cookies = parseCookies(cookieHeader);
  const userId = verifySession(cookies[SESSION_COOKIE]);
  if (!userId) return null;
  const user = await getUser(userId);
  if (!user) return null; // deleted/revoked since the token was issued
  return {
    userId,
    displayName: user.display_name ?? null,
    handle: userId.startsWith('web:') ? userId.slice('web:'.length) : userId,
  };
}
