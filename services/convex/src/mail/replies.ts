import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";

type ReplyMessage = Pick<
  Doc<"messages">,
  "_id" | "accountId" | "internetMessageId" | "ownerId" | "remoteMessageId"
>;

export function resolveReplyMetadata(
  message: ReplyMessage,
  ownerId: string,
  accountId: Id<"mailAccounts">,
) {
  if (message.ownerId !== ownerId) {
    throw new ConvexError("Message not found");
  }
  if (message.accountId !== accountId) {
    throw new ConvexError("Reply message must belong to the sending account");
  }
  return {
    replyToInternetMessageId: message.internetMessageId,
    replyToMessageId: message._id,
    replyToRemoteMessageId: message.remoteMessageId,
  };
}
