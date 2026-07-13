import { useState } from "react";
import { Alert } from "react-native";
import { useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { MailboxFilter } from "./mailbox-controls";
import { toConvexId } from "../lib/convex-id";
import { toggleSelectedThread } from "./mailbox-controls";

export function useArchiveActions() {
  const restore = useMutation(api.mail.archiveMutations.restoreArchivedThread);
  const permanentlyDelete = useMutation(
    api.mail.archiveMutations.permanentlyDeleteArchivedThread,
  );
  const [filter, setFilter] = useState<MailboxFilter>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());

  function toggleSelectionMode() {
    setSelectionMode((current) => !current);
    setSelectedIds(new Set());
  }
  function changeFilter(nextFilter: MailboxFilter) {
    setFilter(nextFilter);
    setSelectedIds(new Set());
  }
  function toggleThreadSelection(threadId: string) {
    setSelectedIds((current) => toggleSelectedThread(current, threadId));
  }
  async function restoreThreads(threadIds: string[]) {
    try {
      await Promise.all(
        threadIds.map(async (threadId) =>
          restore({ threadId: toConvexId<"threads">(threadId) }),
        ),
      );
      if (selectionMode) toggleSelectionMode();
    } catch {
      Alert.alert("Couldn’t restore mail", "Please try again.");
    }
  }
  function confirmDelete(threadIds: string[]) {
    Alert.alert(
      getDeleteTitle(threadIds.length),
      "This removes Rodge Mail’s archived copy and cannot be undone. Your provider copy is unchanged.",
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => void deleteThreads(threadIds),
          style: "destructive",
          text: "Delete permanently",
        },
      ],
    );
  }
  async function deleteThreads(threadIds: string[]) {
    try {
      await Promise.all(
        threadIds.map(async (threadId) =>
          permanentlyDelete({ threadId: toConvexId<"threads">(threadId) }),
        ),
      );
      if (selectionMode) toggleSelectionMode();
    } catch {
      Alert.alert("Couldn’t delete mail", "Please try again.");
    }
  }

  const selectedThreadIds = [...selectedIds];
  const bulkActions = [
    {
      label: "Restore",
      onPress: () => void restoreThreads(selectedThreadIds),
    },
    {
      destructive: true,
      label: "Delete",
      onPress: () => confirmDelete(selectedThreadIds),
    },
  ];
  return {
    bulkActions,
    changeFilter,
    confirmDelete,
    filter,
    restoreThreads,
    selectedIds,
    selectionMode,
    toggleSelectionMode,
    toggleThreadSelection,
  };
}

function getDeleteTitle(count: number) {
  if (count === 1) return "Permanently delete this conversation?";
  return `Permanently delete ${count} conversations?`;
}
