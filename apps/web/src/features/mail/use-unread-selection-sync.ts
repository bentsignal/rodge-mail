import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

import type { InboxMessage, MailThreadDetail } from "./types";
import { useMailStore } from "./store";
import { resolveUnreadSelection } from "./unread-selection";

export function useUnreadSelectionSync({
  inboxMessages,
  isLoadingInbox,
  isLoadingThread,
  selectedThread,
  selectedThreadId,
  unreadOnly,
}: {
  inboxMessages: InboxMessage[];
  isLoadingInbox: boolean;
  isLoadingThread: boolean;
  selectedThread: MailThreadDetail | undefined;
  selectedThreadId: InboxMessage["threadId"] | undefined;
  unreadOnly: boolean;
}) {
  const clearSelection = useMailStore((store) => store.clearSelection);
  const selectThread = useMailStore((store) => store.selectThread);
  const navigate = useNavigate();
  const resolution = resolveUnreadSelection({
    isLoading: isLoadingInbox,
    isLoadingSelectedThread: isLoadingThread,
    messages: inboxMessages,
    selectedThreadIsUnread: selectedThread
      ? selectedThread.unreadCount > 0
      : undefined,
    selectedThreadId,
    unreadOnly,
  });

  // eslint-disable-next-line no-restricted-syntax -- Live unread queries remove a selected row as soon as it is read, so the reader and URL must follow the remaining result set.
  useEffect(() => {
    if (resolution.type === "preserve") return;
    if (resolution.type === "clear") {
      clearSelection();
      void navigate({ to: "/", search: (previous) => previous });
      return;
    }
    const nextMessage = resolution.message;
    selectThread({
      messageId: nextMessage._id,
      threadId: nextMessage.threadId,
    });
    void navigate({
      to: "/messages/$messageId",
      params: { messageId: nextMessage._id },
      search: (previous) => previous,
    });
  }, [clearSelection, navigate, resolution, selectThread]);
}
