import { useState, type FormEvent } from 'react';
import { login, type Me } from '../api';

export function Login({ onSuccess }: { onSuccess: (me: Me) => void }) {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await login(handle.trim(), password);
    setBusy(false);
    if (res.ok) {
      onSuccess({ handle: res.handle ?? handle.trim(), displayName: res.displayName ?? null, authRequired: true });
    } else {
      setError(res.error ?? 'Login failed');
      setPassword('');
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-title">nanoclaw</div>
        <label className="login-label">
          Handle
          <input
            className="login-input"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </label>
        <label className="login-label">
          Password
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button className="login-button" type="submit" disabled={busy || !handle || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
