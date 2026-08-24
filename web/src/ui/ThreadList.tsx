import { useState } from 'react';
import { ThreadListPrimitive, ThreadListItemPrimitive, useThreadListItemRuntime } from '@assistant-ui/react';

export function ThreadList() {
  return (
    <ThreadListPrimitive.Root className="thread-list">
      <ThreadListPrimitive.New className="thread-list-new">+ New chat</ThreadListPrimitive.New>
      <div className="thread-list-items">
        <ThreadListPrimitive.Items components={{ ThreadListItem }} />
      </div>
    </ThreadListPrimitive.Root>
  );
}

/**
 * A conversation row with a tap-first (⋯) overflow menu for Rename + Archive
 * (calcifer-88d2 / B1, calcifer-6d5a / B2). Rename edits inline; both actions
 * drive the assistant-ui item runtime, which routes through the ExternalStore
 * adapter (runtime.tsx) to persist via thread_meta.
 */
function ThreadListItem() {
  const item = useThreadListItemRuntime();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startRename = () => {
    setDraft(item.getState().title ?? '');
    setEditing(true);
    setMenuOpen(false);
  };
  const commitRename = () => {
    const next = draft.trim();
    if (next) void item.rename(next);
    setEditing(false);
  };
  const archive = () => {
    setMenuOpen(false);
    void item.archive();
  };

  if (editing) {
    return (
      <ThreadListItemPrimitive.Root className="thread-list-item">
        <input
          className="thread-rename-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            else if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={commitRename}
        />
      </ThreadListItemPrimitive.Root>
    );
  }

  return (
    <ThreadListItemPrimitive.Root className="thread-list-item">
      <ThreadListItemPrimitive.Trigger className="thread-list-item-trigger">
        <ThreadListItemPrimitive.Title fallback="New chat" />
      </ThreadListItemPrimitive.Trigger>
      <button
        className="thread-item-menu-btn"
        aria-label="Conversation options"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((o) => !o);
        }}
      >
        ⋯
      </button>
      {menuOpen && (
        <>
          <div className="thread-item-menu-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="thread-item-menu" role="menu">
            <button className="thread-item-menu-action" role="menuitem" onClick={startRename}>
              Rename
            </button>
            <button className="thread-item-menu-action" role="menuitem" onClick={archive}>
              Archive
            </button>
          </div>
        </>
      )}
    </ThreadListItemPrimitive.Root>
  );
}
