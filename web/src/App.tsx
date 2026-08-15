import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useParams } from 'react-router-dom';
import { fetchMe, logout, type Me } from './api';
import { RuntimeProvider } from './runtime';
import { ThreadList } from './ui/ThreadList';
import { Thread } from './ui/Thread';
import { fetchManifest, fetchViewList } from './views/api';
import type { ViewManifest, ViewSummary } from './views/types';
import { ViewList } from './views/ViewList';
import { ViewTree } from './views/ViewTree';
import { ViewDetail } from './views/ViewDetail';
import { Login } from './ui/Login';

type AuthState = { status: 'loading' } | { status: 'anon' } | { status: 'authed'; me: Me };

export function App() {
  return (
    <BrowserRouter>
      <AuthedApp />
    </BrowserRouter>
  );
}

function AuthedApp() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void fetchMe().then((me) => {
      if (!cancelled) setAuth(me ? { status: 'authed', me } : { status: 'anon' });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (auth.status === 'loading') return <div className="app-loading">Loading…</div>;
  if (auth.status === 'anon') return <Login onSuccess={(me) => setAuth({ status: 'authed', me })} />;

  const onLogout = async () => {
    await logout();
    setAuth({ status: 'anon' });
  };

  return <Shell me={auth.me} onLogout={onLogout} />;
}

function Shell({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [views, setViews] = useState<ViewSummary[]>([]);
  useEffect(() => {
    void fetchViewList().then(setViews);
  }, []);
  const label = me.displayName || me.handle;

  return (
    <RuntimeProvider>
      <div className="shell">
        <nav className="rail">
          <div className="rail-brand">nanoclaw</div>
          <NavLink to="/" end className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}>
            Chat
          </NavLink>
          {views.length > 0 && <div className="rail-section">Apps</div>}
          {views.map((v) => (
            <NavLink
              key={v.view}
              to={`/app/${v.view}`}
              className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}
            >
              {v.title}
            </NavLink>
          ))}
          <div className="rail-spacer" />
          {me.authRequired && (
            <button className="rail-logout" title={`Signed in as ${label}`} onClick={onLogout}>
              Sign out
            </button>
          )}
        </nav>

        <main className="shell-main">
          <Routes>
            <Route path="/" element={<ChatPane />} />
            <Route path="/app/:view" element={<ViewIndex />} />
            <Route path="/app/:view/:id" element={<ViewDetail />} />
          </Routes>
        </main>
      </div>
    </RuntimeProvider>
  );
}

/** Dispatch the list-level presentation from the manifest (cards vs folder tree). */
function ViewIndex() {
  const { view = '' } = useParams();
  const [manifest, setManifest] = useState<ViewManifest | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setManifest(null);
    setErr(false);
    fetchManifest(view)
      .then((m) => !cancelled && setManifest(m))
      .catch(() => !cancelled && setErr(true));
    return () => {
      cancelled = true;
    };
  }, [view]);
  if (err) return <div className="view-error">Could not load this view.</div>;
  if (!manifest) return <div className="view-loading">Loading…</div>;
  return manifest.presentation === 'tree' ? <ViewTree manifest={manifest} /> : <ViewList />;
}

function ChatPane() {
  return (
    <div className="chat">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span>Conversations</span>
        </div>
        <ThreadList />
      </aside>
      <div className="chat-main">
        <Thread />
      </div>
    </div>
  );
}
