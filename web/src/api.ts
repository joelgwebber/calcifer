/** Auth API helpers (calcifer-7c3a.6). Cookies are same-origin; no tokens in JS. */

export interface Me {
  handle: string;
  displayName: string | null;
  authRequired: boolean;
}

/** Current session, or null if unauthenticated. */
export async function fetchMe(): Promise<Me | null> {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    if (!res.ok) return null;
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

export interface LoginResult {
  ok: boolean;
  handle?: string;
  displayName?: string | null;
  error?: string;
}

export async function login(handle: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { handle?: string; displayName?: string | null; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? `Login failed (${res.status})` };
    return { ok: true, handle: data.handle, displayName: data.displayName ?? null };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // best-effort
  }
}
