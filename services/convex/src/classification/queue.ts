import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { reconcileEmbeddingSelection } from "../embedding/internal";
import { CLASSIFICATION_OUTPUT_SCHEMA_VERSION } from "./constants";
import { normalizeMail, stableHash } from "./normalize";
import { pendingClassificationMetadata } from "./pending";

interface ClassificationActionArgs extends Record<string, unknown> {
  messageId: Id<"messages">;
  jobKey: string;
}

const RUN_CLASSIFICATION = makeFunctionReference<
  "action",
  ClassificationActionArgs,
  null
>("classification/actions:runClassification");

// eslint-disable-next-line complexity
export async function queueClassificationForMessage(
  ctx: MutationCtx,
  args: {
    ownerId: string;
    messageId: Id<"messages">;
    promptVersion: string;
    replaceManual: boolean;
    generateCleanView?: boolean;
  },
) {
  const [message, content, existing] = await Promise.all([
    ctx.db.get(args.messageId),
    ctx.db
      .query("messageContents")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .first(),
    findClassification(ctx, args.messageId),
  ]);
  if (!message || message.ownerId !== args.ownerId) {
    throw new ConvexError("Message not found");
  }
  if (existing?.source === "manual" && !args.replaceManual) {
    return { classificationId: existing._id, queued: false };
  }

  const inputHash = stableHash(normalizeMail(message, content));
  const jobKey = `${args.promptVersion}:${message._id}:${inputHash}`;
  if (existing && isCurrentClassification(existing, jobKey)) {
    return { classificationId: existing._id, queued: false };
  }

  const now = Date.now();
  const metadata = pendingClassificationMetadata(existing, message.snippet);
  const values = {
    status: "pending" as const,
    ...metadata,
    source: "rules" as const,
    promptVersion: args.promptVersion,
    outputSchemaVersion: CLASSIFICATION_OUTPUT_SCHEMA_VERSION,
    jobKey,
    inputHash,
    attempt: 0,
    nextAttemptAt: undefined,
    signals: undefined,
    model: undefined,
    error: undefined,
    recoveryAttemptedAt: undefined,
    generateCleanViewAfterClassification:
      args.generateCleanView ?? existing?.generateCleanViewAfterClassification,
    classifiedAt: undefined,
    updatedAt: now,
  };
  const classificationId = existing
    ? existing._id
    : await ctx.db.insert("messageClassifications", {
        ownerId: args.ownerId,
        messageId: args.messageId,
        ...values,
        createdAt: now,
      });
  if (existing) await ctx.db.patch(existing._id, values);
  await reconcileEmbeddingSelection(ctx, message._id);
  await ctx.scheduler.runAfter(0, RUN_CLASSIFICATION, {
    messageId: args.messageId,
    jobKey,
  });
  return { classificationId, queued: true };
}

export async function findClassification(
  ctx: Pick<MutationCtx, "db"> | Pick<QueryCtx, "db">,
  messageId: Id<"messages">,
) {
  return await ctx.db
    .query("messageClassifications")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .first();
}

function isCurrentClassification(
  classification: NonNullable<Awaited<ReturnType<typeof findClassification>>>,
  jobKey: string,
) {
  return classification.jobKey === jobKey && classification.status !== "failed";
}
