import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";

import type { MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";

import { toConvexId } from "../lib/convex-id";

export function useThreadReaderActions(thread: MailThread) {
  const router = useRouter();
  const archiveThread = useMutation(api.mail.mutations.archiveThread);
  const restoreArchivedThread = useMutation(
    api.mail.archiveMutations.restoreArchivedThread,
  );
  const permanentlyDeleteArchivedThread = useMutation(
    api.mail.archiveMutations.permanentlyDeleteArchivedThread,
  );
  const setThreadPinned = useMutation(api.mail.mutations.setThreadPinned);
  const [pinOverride, setPinOverride] = useState<boolean>();
  const isPinned = pinOverride ?? thread.isPinned;

  async function togglePin() {
    const nextIsPinned = !isPinned;
    setPinOverride(nextIsPinned);
    try {
      await setThreadPinned({
        threadId: toConvexId<"threads">(thread.id),
        isPinned: nextIsPinned,
      });
    } catch {
      setPinOverride(undefined);
    }
  }
  async function archive() {
    try {
      await archiveThread({ threadId: toConvexId<"threads">(thread.id) });
      router.back();
    } catch {
      Alert.alert("Couldn’t archive this thread", "Please try again.");
    }
  }
  async function restore() {
    try {
      await restoreArchivedThread({
        threadId: toConvexId<"threads">(thread.id),
      });
      router.back();
    } catch {
      Alert.alert("Couldn’t restore this thread", "Please try again.");
    }
  }
  function confirmPermanentDelete() {
    Alert.alert(
      "Permanently delete this conversation?",
      "This removes Rodge Mail’s archived copy and cannot be undone. Your provider copy is unchanged.",
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => void permanentlyDelete(),
          style: "destructive",
          text: "Delete permanently",
        },
      ],
    );
  }
  async function permanentlyDelete() {
    try {
      await permanentlyDeleteArchivedThread({
        threadId: toConvexId<"threads">(thread.id),
      });
      router.back();
    } catch {
      Alert.alert("Couldn’t delete this thread", "Please try again.");
    }
  }
  return {
    archive,
    confirmPermanentDelete,
    isPinned,
    restore,
    togglePin,
  };
}
