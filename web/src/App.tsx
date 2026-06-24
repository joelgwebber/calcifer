import { RuntimeProvider } from "./runtime";
import { ThreadList } from "./ui/ThreadList";
import { Thread } from "./ui/Thread";

export function App() {
  return (
    <RuntimeProvider>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-header">nanoclaw</div>
          <ThreadList />
        </aside>
        <main className="main">
          <Thread />
        </main>
      </div>
    </RuntimeProvider>
  );
}
