"use node";

/* eslint-disable @typescript-eslint/consistent-type-assertions -- Node and Convex Blob declarations use different ArrayBuffer generics. */
import { Blob as NodeBlob } from "node:buffer";
import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { GmailAdapter } from "../providers/gmail/api";
import { getUsableGmailTokens } from "../providers/gmail/tokenAccess";
import { MicrosoftGraphAdapter } from "../providers/microsoft/api";
import { getUsableMicrosoftTokens } from "../providers/microsoft/tokenAccess";
import { checkIdentity } from "../utils";
import { MAX_ATTACHMENT_BYTES } from "./constants";

export const download = action({
  args: { attachmentId: v.id("attachments") },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const user = await checkIdentity(ctx);
    const ownerId = user.subject;
    const context = await ctx.runQuery(
      internal.attachments.internal.getDownloadContext,
      { ownerId, attachmentId: args.attachmentId },
    );
    if (!context) throw new ConvexError("Attachment not found");
    if (context.attachment.storageId) {
      return {
        url: requireDownloadUrl(
          await ctx.storage.getUrl(context.attachment.storageId),
        ),
      };
    }
    if (context.attachment.size > MAX_ATTACHMENT_BYTES) {
      throw new ConvexError("Attachments larger than 10 MB are not cached yet");
    }
    if (!context.credential) {
      throw new ConvexError(
        "This provider attachment is still remote and cannot be fetched yet",
      );
    }
    try {
      const tokenArgs = {
        ownerId,
        accountId: context.account._id,
        encryptedTokens: context.credential.encryptedTokens,
      };
      let bytes: Uint8Array;
      if (context.account.provider === "gmail") {
        const tokens = await getUsableGmailTokens(ctx, tokenArgs);
        bytes = await new GmailAdapter().fetchAttachment(
          tokens.accessToken,
          context.message.remoteMessageId,
          context.attachment.remoteAttachmentId,
        );
      } else if (context.account.provider === "microsoft") {
        const tokens = await getUsableMicrosoftTokens(ctx, tokenArgs);
        bytes = await new MicrosoftGraphAdapter().fetchAttachment(
          tokens.accessToken,
          context.message.remoteMessageId,
          context.attachment.remoteAttachmentId,
        );
      } else {
        throw new ConvexError("This provider attachment cannot be fetched yet");
      }
      if (bytes.byteLength !== context.attachment.size) {
        throw new Error(
          "Downloaded attachment size did not match provider metadata",
        );
      }
      const storageId = await ctx.storage.store(
        new NodeBlob([bytes], {
          type: context.attachment.contentType,
        }) as unknown as Blob,
      );
      const committedStorageId = await ctx.runMutation(
        internal.attachments.internal.commitDownloadedFile,
        { ownerId, attachmentId: args.attachmentId, storageId },
      );
      if (!committedStorageId) {
        await ctx.storage.delete(storageId);
        throw new ConvexError("Attachment was removed while downloading");
      }
      if (committedStorageId !== storageId) {
        await ctx.storage.delete(storageId);
      }
      return {
        url: requireDownloadUrl(await ctx.storage.getUrl(committedStorageId)),
      };
    } catch (error) {
      await ctx.runMutation(internal.attachments.internal.markDownloadFailed, {
        ownerId,
        attachmentId: args.attachmentId,
      });
      throw error;
    }
  },
});

function requireDownloadUrl(url: string | null) {
  if (!url) throw new ConvexError("Attachment file is unavailable");
  return url;
}
