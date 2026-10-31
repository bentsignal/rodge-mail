import type { OptimisticLocalStore } from "convex/browser";

import type { Doc, Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

import { toConvexId } from "../lib/convex-id";

interface ThreadMessageWithCleanView {
  _id: Id<"messages">;
  cleanView: Doc<"messageCleanViews"> | null;
  ownerId: string;
}

export function optimisticallyGenerateCleanView(
  store: OptimisticLocalStore,
  args: { messageId: Id<"messages"> },
) {
  for (const query of store.getAllQueries(api.mail.queries.getThread)) {
    if (!query.value) continue;
    store.setQuery(
      api.mail.queries.getThread,
      query.args,
      markCleanViewPending(query.value, args.messageId, Date.now()),
    );
  }
}

export function markCleanViewPending<
  TMessage extends ThreadMessageWithCleanView,
  TThread extends { messages: TMessage[] },
>(thread: TThread, messageId: Id<"messages">, now: number) {
  if (!thread.messages.some((message) => message._id === messageId)) {
    return thread;
  }
  return {
    ...thread,
    messages: thread.messages.map((message) => {
      if (message._id !== messageId) return message;
      const cleanView = {
        _creationTime: now,
        _id: toConvexId<"messageCleanViews">(`optimistic-${messageId}`),
        createdAt: now,
        inputHash: "",
        jobKey: "",
        messageId,
        outputSchemaVersion: "",
        ownerId: message.ownerId,
        promptVersion: "",
        ...message.cleanView,
        status: "pending",
        updatedAt: now,
      } satisfies Doc<"messageCleanViews">;
      return { ...message, cleanView };
    }),
  };
}
