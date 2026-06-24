import {
  ThreadListPrimitive,
  ThreadListItemPrimitive,
} from "@assistant-ui/react";

// TODO verify against installed types: ThreadListPrimitive.{Root,New,Items},
// ThreadListItemPrimitive.{Root,Trigger,Title}.
export function ThreadList() {
  return (
    <ThreadListPrimitive.Root className="thread-list">
      <ThreadListPrimitive.New className="thread-list-new">
        + New chat
      </ThreadListPrimitive.New>
      <div className="thread-list-items">
        <ThreadListPrimitive.Items
          components={{ ThreadListItem }}
        />
      </div>
    </ThreadListPrimitive.Root>
  );
}

function ThreadListItem() {
  return (
    <ThreadListItemPrimitive.Root className="thread-list-item">
      <ThreadListItemPrimitive.Trigger className="thread-list-item-trigger">
        <ThreadListItemPrimitive.Title fallback="New chat" />
      </ThreadListItemPrimitive.Trigger>
    </ThreadListItemPrimitive.Root>
  );
}
