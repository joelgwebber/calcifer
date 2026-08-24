import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { fetchMe, logout, type Me } from './api';
import { RuntimeProvider } from './runtime';
import { ThreadList } from './ui/ThreadList';
import { Thread } from './ui/Thread';
import { fetchManifest, fetchViewList } from './views/api';
import type { ViewManifest, ViewSummary } from './views/types';
import { ViewList } from './views/ViewList';
import { ViewBrowse } from './views/ViewBrowse';
import { ViewDetail } from './views/ViewDetail';
import { Login } from './ui/Login';
import { useLayoutMode, useNav } from './ui/layout';

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

  const mode = useLayoutMode();
  const isMobile = mode === 'mobile';
  const { collapsed, drawerOpen, toggleCollapsed, setCollapsed, closeDrawer, toggleDrawer } = useNav();
  const { pathname } = useLocation();

  // A tap on a nav link closes the mobile drawer; leaving mobile drops it too.
  useEffect(() => {
    if (isMobile) closeDrawer();
  }, [pathname, isMobile, closeDrawer]);

  // The floating toggle opens the drawer on mobile, or re-expands a collapsed
  // desktop rail. The in-rail chevron collapses it again on desktop.
  const onFloatingToggle = () => (isMobile ? toggleDrawer() : setCollapsed(false));

  const shellClass = [
    'shell',
    `shell-${mode}`,
    !isMobile && collapsed ? 'nav-collapsed' : '',
    isMobile && drawerOpen ? 'nav-drawer-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <RuntimeProvider>
      <div className={shellClass}>
        <button className="nav-toggle" aria-label="Open navigation" onClick={onFloatingToggle}>
          ☰
        </button>
        <div className="nav-backdrop" onClick={closeDrawer} aria-hidden="true" />

        <nav className="rail">
          <div className="rail-head">
            <div className="rail-brand">hearth</div>
            {!isMobile && (
              <button
                className="rail-collapse"
                aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                onClick={toggleCollapsed}
              >
                {collapsed ? '›' : '‹'}
              </button>
            )}
          </div>

          <div className="rail-nav">
            <NavLink to="/" end className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`} title="Chat">
              <span className="rail-icon">💬</span>
              <span className="rail-label">Chat</span>
            </NavLink>
            {groupViews(views).map(({ group, items }) => (
              <div className="rail-group" key={group ?? '__top'}>
                <div className="rail-section">{group ?? 'Apps'}</div>
                {items.map((v) => (
                  <NavLink
                    key={v.view}
                    to={`/app/${v.view}`}
                    className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}
                    title={v.title}
                  >
                    <span className="rail-icon">{viewGlyph(v)}</span>
                    <span className="rail-label">{v.title}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </div>

          <div className="rail-convos">
            <div className="rail-section">Conversations</div>
            <ThreadList />
          </div>

          {me.authRequired && (
            <button className="rail-logout" title={`Signed in as ${label}`} onClick={onLogout}>
              <span className="rail-icon">⏻</span>
              <span className="rail-label">Sign out</span>
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
  return manifest.presentation === 'tree' || manifest.presentation === 'gallery' ? (
    <ViewBrowse manifest={manifest} />
  ) : (
    <ViewList />
  );
}

/** Group rail views by their `group` label; ungrouped (top-level) apps come first. */
function groupViews(views: ViewSummary[]): Array<{ group: string | null; items: ViewSummary[] }> {
  const order: Array<string | null> = [];
  const byGroup = new Map<string | null, ViewSummary[]>();
  for (const v of views) {
    const g = v.group ?? null;
    if (!byGroup.has(g)) {
      byGroup.set(g, []);
      order.push(g);
    }
    byGroup.get(g)!.push(v);
  }
  // Ungrouped first, then named groups in first-seen order.
  order.sort((a, b) => (a === null ? -1 : b === null ? 1 : 0));
  return order.map((g) => ({ group: g, items: byGroup.get(g)! }));
}

function ChatPane() {
  // Conversations now live in the unified rail (A2); the chat route is just the
  // transcript + composer, filling the shell's main region.
  return (
    <div className="chat">
      <div className="chat-main">
        <Thread />
      </div>
    </div>
  );
}

/** Emoji glyph for a view's rail icon (manifest `icon`), monogram fallback. */
const VIEW_ICONS: Record<string, string> = {
  book: '📚',
  building: '🏢',
  folder: '📁',
  image: '🖼️',
};
function viewGlyph(v: ViewSummary): string {
  return (v.icon && VIEW_ICONS[v.icon]) || v.title.slice(0, 1).toUpperCase();
}
