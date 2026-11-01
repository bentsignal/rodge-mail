import { v } from "convex/values";

import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { NormalizedMessage } from "../types";
import { internalMutation, internalQuery } from "../../_generated/server";
import { vNormalizedMessage, writeProviderMessage } from "../../sync/internal";

// Mail that both the old provider and SES received while DNS moved.
const CUTOVER_WINDOW_MS = 24 * 60 * 60 * 1000;

export const findImported = internalQuery({
  args: {
    targetAccountId: v.id("mailAccounts"),
    remoteMessageIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const found = await Promise.all(
      args.remoteMessageIds.map(async (remoteMessageId) => {
        const [message, tombstone] = await Promise.all([
          ctx.db
            .query("messages")
            .withIndex("by_account_remote", (q) =>
              q
                .eq("accountId", args.targetAccountId)
                .eq("remoteMessageId", remoteMessageId),
            )
            .first(),
          ctx.db
            .query("archivedMessageTombstones")
            .withIndex("by_account_remote", (q) =>
              q
                .eq("accountId", args.targetAccountId)
                .eq("remoteMessageId", remoteMessageId),
            )
            .first(),
        ]);
        return message || tombstone ? [remoteMessageId] : [];
      }),
    );
    return found.flat();
  },
});

export const ingestMessage = internalMutation({
  args: {
    ownerId: v.string(),
    targetAccountId: v.id("mailAccounts"),
    message: vNormalizedMessage,
  },
  handler: async (ctx, args): Promise<"imported" | "skipped" | "duplicate"> => {
    const message = args.message;
    const account = await ctx.db.get(args.targetAccountId);
    if (account?.ownerId !== args.ownerId || account.provider !== "hosted") {
      throw new Error("The hosted account is unavailable");
    }
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_account_remote", (q) =>
        q
          .eq("accountId", account._id)
          .eq("remoteMessageId", message.remoteMessageId),
      )
      .first();
    if (existing) return "skipped";
    if (await hasCutoverCopy(ctx, account, message)) return "duplicate";
    await writeProviderMessage(ctx, {
      ownerId: args.ownerId,
      accountId: account._id,
      message,
      notifyNewMail: false,
      automaticCleanView: false,
    });
    return "imported";
  },
});

async function hasCutoverCopy(
  ctx: MutationCtx,
  account: Doc<"mailAccounts">,
  message: NormalizedMessage,
) {
  const internetMessageId = message.internetMessageId;
  if (
    !internetMessageId ||
    message.receivedAt < account.createdAt - CUTOVER_WINDOW_MS
  ) {
    return false;
  }
  const nearby = await ctx.db
    .query("messages")
    .withIndex("by_account_received", (q) =>
      q
        .eq("accountId", account._id)
        .gte("receivedAt", message.receivedAt - CUTOVER_WINDOW_MS)
        .lte("receivedAt", message.receivedAt + CUTOVER_WINDOW_MS),
    )
    .take(200);
  return nearby.some(
    (item) =>
      item.internetMessageId === internetMessageId &&
      !item.remoteMessageId.startsWith("import:"),
  );
}
