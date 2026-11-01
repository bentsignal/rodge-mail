import { Alert } from "react-native";
import { useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import { toConvexId } from "../lib/convex-id";
import { optimisticallyMoveThreadToInbox } from "./move-to-inbox-optimistic";

export function useMoveToInbox() {
  const move = useMutation(
    api.mail.archiveMutations.moveThreadToInbox,
  ).withOptimisticUpdate(optimisticallyMoveThreadToInbox);
  return (threadId: string) => {
    void move({ threadId: toConvexId<"threads">(threadId) }).catch(() => {
      Alert.alert("Couldn’t move this conversation", "Please try again.");
    });
  };
}
