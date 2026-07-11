import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { AuthedMutationCtx } from "../utils";
import { authedMutation } from "../utils";
import {
  MAX_ATTACHMENT_COUNT,
  normalizeAttachmentContentType,
  normalizeAttachmentFileName,
  validateAttachmentMetadata,
} from "./constants";

const MAX_ACTIVE_DRAFT_ATTACHMENTS = MAX_ATTACHMENT_COUNT * 4;

export const generateUploadUrl = authedMutation({
  args: {
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const error = validateAttachmentMetadata(args);
    if (error) throw new ConvexError(error);
    const [pending, ready] = await Promise.all([
      ctx.db
        .query("draftAttachments")
        .withIndex("by_owner_status_created", (q) =>
          q.eq("ownerId", ctx.ownerId).eq("status", "pending"),
        )
        .collect(),
      ctx.db
        .query("draftAttachments")
        .withIndex("by_owner_status_created", (q) =>
          q.eq("ownerId", ctx.ownerId).eq("status", "ready"),
        )
        .collect(),
    ]);
    if (pending.length + ready.length >= MAX_ACTIVE_DRAFT_ATTACHMENTS) {
      throw new ConvexError(
        "Remove abandoned attachments before uploading more.",
      );
    }
    const now = Date.now();
    const fileName = normalizeAttachmentFileName(args.fileName);
    const contentType = normalizeAttachmentContentType(args.contentType);
    const attachmentId = await ctx.db.insert("draftAttachments", {
      ownerId: ctx.ownerId,
      fileName,
      contentType,
      declaredSize: args.size,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return {
      attachmentId,
      contentType,
      fileName,
      uploadUrl: await ctx.storage.generateUploadUrl(),
    };
  },
});

export const finalizeUpload = authedMutation({
  args: {
    attachmentId: v.id("draftAttachments"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const attachment = await getOwnedAttachment(ctx, args.attachmentId);
    if (attachment.status === "ready") {
      if (attachment.storageId !== args.storageId) {
        throw new ConvexError("Draft attachment is already finalized");
      }
      if (attachment.size === undefined) {
        throw new ConvexError("Draft attachment metadata is unavailable");
      }
      return readyAttachmentResult({ ...attachment, size: attachment.size });
    }
    if (attachment.status !== "pending") {
      throw new ConvexError("Draft attachment is unavailable");
    }
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (!metadata) {
      await ctx.db.delete(attachment._id);
      return { ok: false as const, error: "Uploaded file was not found." };
    }
    const duplicate = await ctx.db
      .query("draftAttachments")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .first();
    if (duplicate) {
      await ctx.db.delete(attachment._id);
      return { ok: false as const, error: "Uploaded file is already in use." };
    }
    const contentType = normalizeAttachmentContentType(
      metadata.contentType ?? "",
    );
    const error = getFinalizationError({ attachment, contentType, metadata });
    if (error) {
      await ctx.storage.delete(args.storageId);
      await ctx.db.delete(attachment._id);
      return {
        ok: false as const,
        error,
      };
    }
    await ctx.db.patch(attachment._id, {
      storageId: args.storageId,
      size: metadata.size,
      sha256: metadata.sha256,
      status: "ready",
      updatedAt: Date.now(),
    });
    return readyAttachmentResult({
      ...attachment,
      contentType,
      size: metadata.size,
      storageId: args.storageId,
      status: "ready",
    });
  },
});

async function getOwnedAttachment(
  ctx: AuthedMutationCtx,
  attachmentId: Doc<"draftAttachments">["_id"],
) {
  const attachment = await ctx.db.get(attachmentId);
  if (!attachment || attachment.ownerId !== ctx.ownerId) {
    throw new ConvexError("Draft attachment is unavailable");
  }
  return attachment;
}

function readyAttachmentResult(
  attachment: Doc<"draftAttachments"> & { size: number },
) {
  return {
    ok: true as const,
    attachment: {
      _id: attachment._id,
      contentType: attachment.contentType,
      fileName: attachment.fileName,
      size: attachment.size,
    },
  };
}

function getFinalizationError({
  attachment,
  contentType,
  metadata,
}: {
  attachment: Doc<"draftAttachments">;
  contentType: string;
  metadata: { contentType?: string; sha256: string; size: number };
}) {
  const metadataError = validateAttachmentMetadata({
    contentType,
    fileName: attachment.fileName,
    size: metadata.size,
  });
  if (metadataError) return metadataError;
  if (
    contentType !== attachment.contentType ||
    metadata.size !== attachment.declaredSize
  ) {
    return "Uploaded file metadata did not match the selection.";
  }
  return undefined;
}

export const removeDraft = authedMutation({
  args: { attachmentId: v.id("draftAttachments") },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment || attachment.ownerId !== ctx.ownerId) return;
    if (attachment.status === "claimed") {
      throw new ConvexError("Queued message attachments cannot be removed");
    }
    if (attachment.storageId) await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete(attachment._id);
  },
});
