import { useEffect, useState } from 'react';
import { fetchMe, logout, type Me } from './api';
import { RuntimeProvider } from './runtime';
import { Login } from './ui/Login';
import { ThreadList } from './ui/ThreadList';
import { Thread } from './ui/Thread';

type AuthState = { status: 'loading' } | { status: 'anon' } | { status: 'authed'; me: Me };

export function App() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void fetchMe().then((me) => {
      if (cancelled) return;
      setAuth(me ? { status: 'authed', me } : { status: 'anon' });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (auth.status === 'loading') {
    return <div className="app-loading">Loading…</div>;
  }
  if (auth.status === 'anon') {
    return <Login onSuccess={(me) => setAuth({ status: 'authed', me })} />;
  }

  const onLogout = async () => {
    await logout();
    setAuth({ status: 'anon' });
  };

  return <ChatApp me={auth.me} onLogout={onLogout} />;
}

function ChatApp({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const label = me.displayName || me.handle;
  return (
    <RuntimeProvider>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-header">
            <span>nanoclaw</span>
            {me.authRequired && (
              <button className="logout-button" title={`Signed in as ${label}`} onClick={onLogout}>
                Sign out
              </button>
            )}
          </div>
          <ThreadList />
        </aside>
        <main className="main">
          <Thread />
        </main>
      </div>
    </RuntimeProvider>
  );
}
