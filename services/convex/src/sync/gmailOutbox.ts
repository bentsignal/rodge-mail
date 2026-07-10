"use node";

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { GmailAdapter } from "../providers/gmail/api";
import { getUsableGmailTokens } from "../providers/gmail/tokenAccess";

export const deliver = internalAction({
  args: { outboxId: v.id("outboxMessages") },
  handler: async (ctx, args): Promise<void> => {
    const outbox = await ctx.runMutation(
      internal.sync.internal.claimOutbox,
      args,
    );
    if (!outbox) return;
    try {
      const connection = await ctx.runQuery(
        internal.sync.internal.getGmailSyncContext,
        { ownerId: outbox.ownerId, accountId: outbox.accountId },
      );
      if (!connection) throw new Error("Gmail connection is unavailable");
      const tokens = await getUsableGmailTokens(ctx, {
        ownerId: outbox.ownerId,
        accountId: outbox.accountId,
        encryptedTokens: connection.credential.encryptedTokens,
      });
      const attachments = await Promise.all(
        outbox.attachments.map(async (attachment) => {
          const url = await ctx.storage.getUrl(attachment.storageId);
          if (!url) throw new Error(`${attachment.fileName} is unavailable`);
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(
              `Could not read ${attachment.fileName} from storage`,
            );
          }
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.byteLength !== attachment.size) {
            throw new Error(`${attachment.fileName} failed its size check`);
          }
          return { ...attachment, bytes };
        }),
      );
      const result = await new GmailAdapter().sendMessage(tokens.accessToken, {
        _id: outbox._id,
        accountId: outbox.accountId,
        from: outbox.from,
        to: outbox.to,
        cc: outbox.cc,
        bcc: outbox.bcc,
        subject: outbox.subject,
        plainText: outbox.plainText,
        replyToInternetMessageId: outbox.replyToInternetMessageId,
        replyToRemoteMessageId: outbox.replyToRemoteMessageId,
        attachments,
      });
      await ctx.runMutation(internal.sync.internal.finishOutbox, {
        outboxId: outbox._id,
        leaseId: outbox.leaseId,
        remoteMessageId: result.remoteMessageId,
      });
      await ctx.scheduler.runAfter(0, internal.sync.internal.executeGmailSync, {
        ownerId: outbox.ownerId,
        accountId: outbox.accountId,
        reason: "incremental",
      });
    } catch (error) {
      await ctx.runMutation(internal.sync.internal.finishOutbox, {
        outboxId: outbox._id,
        leaseId: outbox.leaseId,
        error: safeErrorMessage(error),
      });
      if (outbox.attempt < 3) {
        await ctx.scheduler.runAfter(
          2 ** outbox.attempt * 1_000,
          internal.sync.internal.deliverGmailOutbox,
          { outboxId: outbox._id },
        );
      }
    }
  },
});

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Send failed";
}
