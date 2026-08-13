import { v } from "convex/values";

export const vMailingListRemoteMethod = v.union(
  v.literal("one_click"),
  v.literal("email"),
  v.literal("none"),
);

export const vMailingListRemoteStatus = v.union(
  v.literal("pending"),
  v.literal("requested"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("unavailable"),
);

export const vMailingListSuppression = v.object({
  ownerId: v.string(),
  accountId: v.id("mailAccounts"),
  sourceMessageId: v.id("messages"),
  senderAddress: v.string(),
  listId: v.optional(v.string()),
  displayName: v.string(),
  remoteMethod: vMailingListRemoteMethod,
  remoteStatus: vMailingListRemoteStatus,
  remoteError: v.optional(v.string()),
  disabledAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});
