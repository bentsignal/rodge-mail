import { useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";
import { toast } from "@rodge-mail/ui-web/toast";

import type { InboxMessage } from "./types";
import { getErrorMessage } from "./live-data-utils";
import { useMailStore } from "./store";
import { optimisticallySetThreadRead } from "./unread-optimistic";

interface UnreadSessionActions {
  forget: (threadId: InboxMessage["threadId"]) => void;
  preserve: (message: InboxMessage) => void;
}

export function useThreadActions(unreadSession?: UnreadSessionActions) {
  const clearBulkSelection = useMailStore((store) => store.clearBulkSelection);
  const setBulkSelectionActive = useMailStore(
    (store) => store.setBulkSelectionActive,
  );
  const setThreadPinned = useMutation(api.mail.mutations.setThreadPinned);
  const setThreadRead = useMutation(
    api.mail.mutations.setThreadRead,
  ).withOptimisticUpdate(optimisticallySetThreadRead);

  async function togglePinned(message: InboxMessage) {
    try {
      await setThreadPinned({
        threadId: message.threadId,
        isPinned: !message.isPinned,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update the pin."));
    }
  }

  async function toggleRead(message: InboxMessage) {
    try {
      if (!message.isRead) unreadSession?.preserve(message);
      await setThreadRead({
        threadId: message.threadId,
        isRead: !message.isRead,
      });
    } catch (error) {
      if (!message.isRead) unreadSession?.forget(message.threadId);
      toast.error(getErrorMessage(error, "Could not update read status."));
    }
  }

  function markMessageRead(message: InboxMessage) {
    if (message.isRead) return;
    unreadSession?.preserve(message);
    void setThreadRead({ threadId: message.threadId, isRead: true }).catch(
      (error) => {
        unreadSession?.forget(message.threadId);
        toast.error(getErrorMessage(error, "Could not mark the message read."));
      },
    );
  }

  async function setThreadsRead(messages: InboxMessage[], isRead: boolean) {
    if (messages.length === 0) return;
    try {
      if (isRead) {
        for (const message of messages) unreadSession?.preserve(message);
      }
      await Promise.all(
        messages.map(async (message) => {
          try {
            await setThreadRead({ threadId: message.threadId, isRead });
          } catch (error) {
            if (isRead) unreadSession?.forget(message.threadId);
            throw error;
          }
        }),
      );
      clearBulkSelection();
      setBulkSelectionActive(false);
      toast.success(
        `${messages.length} conversation${messages.length === 1 ? "" : "s"} marked ${isRead ? "read" : "unread"}.`,
      );
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Could not update the conversations."),
      );
    }
  }

  return { markMessageRead, setThreadsRead, togglePinned, toggleRead };
}
