import { useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";

import { api } from "@rodge-mail/convex/api";
import { toast } from "@rodge-mail/ui-web/toast";

import type { ThreadMessageDetail } from "./types";
import { useMailStore } from "./store";

export function useUnsubscribe() {
  const closeMobileReader = useMailStore((store) => store.closeMobileReader);
  const navigate = useNavigate();
  const unsubscribe = useAction(api.mailingLists.actions.unsubscribe);
  return async (message: ThreadMessageDetail) => {
    try {
      const result = await unsubscribe({ messageId: message._id });
      closeMobileReader();
      await navigate({ to: "/", search: (previous) => previous });
      toast.success(getSuccessMessage(result));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not unsubscribe from this list.",
      );
      throw error;
    }
  };
}

function getSuccessMessage(result: {
  displayName: string;
  remoteStatus: "failed" | "requested" | "succeeded" | "unavailable";
}) {
  if (result.remoteStatus === "succeeded") {
    return `Unsubscribed from ${result.displayName}. Future advertising mail will go to Spam.`;
  }
  if (result.remoteStatus === "requested") {
    return `Sent ${result.displayName} an unsubscribe request. Future advertising mail will go to Spam.`;
  }
  return `${result.displayName} is blocked. Future advertising mail will go to Spam.`;
}
