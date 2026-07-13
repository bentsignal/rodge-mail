import { useState } from "react";

import type { MailThread } from "@rodge-mail/features/mail";

import type { MailboxFilter } from "./mailbox-controls";
import type { MailboxBulkAction } from "./mailbox-thread-list";
import { useMailStore } from "../store";
import { filterMailboxThreads, toggleSelectedThread } from "./mailbox-controls";

export function useInboxMailboxControls(threads: MailThread[]) {
  const archiveThread = useMailStore((store) => store.archiveThread);
  const toggleRead = useMailStore((store) => store.toggleRead);
  const [filter, setFilter] = useState<MailboxFilter>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());
  const [retainedUnreadIds, setRetainedUnreadIds] = useState(
    () => new Set<string>(),
  );

  function toggleSelectionMode() {
    setSelectionMode((current) => !current);
    setSelectedIds(new Set());
  }
  function changeFilter(nextFilter: MailboxFilter) {
    setFilter(nextFilter);
    setSelectedIds(new Set());
    setRetainedUnreadIds(new Set());
  }
  function retainThreadInUnreadSession(threadId: string) {
    if (filter !== "unread") return;
    setRetainedUnreadIds((current) => new Set(current).add(threadId));
  }
  function toggleThreadSelection(threadId: string) {
    setSelectedIds((current) => toggleSelectedThread(current, threadId));
  }
  function getSelectedThreads() {
    return threads.filter((thread) => selectedIds.has(thread.id));
  }
  async function archiveSelected() {
    await Promise.all(
      getSelectedThreads().map(async (thread) => archiveThread(thread.id)),
    );
    toggleSelectionMode();
  }
  async function setSelectedRead(isRead: boolean) {
    const selectedThreads = getSelectedThreads();
    if (isRead && filter === "unread") {
      setRetainedUnreadIds(
        (current) =>
          new Set([...current, ...selectedThreads.map((thread) => thread.id)]),
      );
    }
    await Promise.all(
      selectedThreads
        .filter((thread) => thread.isRead !== isRead)
        .map(async (thread) => toggleRead(thread.id, thread.isRead)),
    );
    toggleSelectionMode();
  }

  const bulkActions = [
    {
      label: "Archive",
      systemImage: "archivebox",
      onPress: () => void archiveSelected(),
    },
    {
      label: "Mark read",
      systemImage: "envelope.open",
      onPress: () => void setSelectedRead(true),
    },
    {
      label: "Mark unread",
      systemImage: "envelope.badge",
      onPress: () => void setSelectedRead(false),
    },
  ] satisfies MailboxBulkAction[];
  return {
    bulkActions,
    changeFilter,
    filter,
    selectedCount: selectedIds.size,
    selectedIds,
    selectionMode,
    retainThreadInUnreadSession,
    threads: filterMailboxThreads(threads, filter, retainedUnreadIds),
    toggleSelectionMode,
    toggleThreadSelection,
  };
}
