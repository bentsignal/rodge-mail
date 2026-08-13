import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { CLASSIFICATION_OUTPUT_SCHEMA_VERSION } from "../classification/constants";
import { reconcileEmbeddingSelection } from "../embedding/internal";
import { getClassificationForMessage } from "../mail/helpers";
import { getMailingListInfo, messageMatchesSuppression } from "./policy";

type ReadCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export async function findMatchingSuppression(
  ctx: ReadCtx,
  message: Doc<"messages">,
  category?: string,
) {
  const info = getMailingListInfo(message, category);
  if (!info) return null;
  if (info.listId) {
    const listRules = await ctx.db
      .query("mailingListSuppressions")
      .withIndex("by_account_list", (q) =>
        q.eq("accountId", message.accountId).eq("listId", info.listId),
      )
      .collect();
    const listRule = listRules.find(
      (rule) => rule.ownerId === message.ownerId && !rule.disabledAt,
    );
    if (listRule) return listRule;
  }
  const senderRules = await ctx.db
    .query("mailingListSuppressions")
    .withIndex("by_account_sender", (q) =>
      q
        .eq("accountId", message.accountId)
        .eq("senderAddress", info.senderAddress),
    )
    .collect();
  return (
    senderRules.find(
      (rule) =>
        rule.ownerId === message.ownerId &&
        !rule.disabledAt &&
        messageMatchesSuppression(message, category, rule),
    ) ?? null
  );
}

export async function suppressMessageAsSpam(
  ctx: MutationCtx,
  message: Doc<"messages">,
  suppressionId: Id<"mailingListSuppressions">,
  now = Date.now(),
) {
  const existing = await getClassificationForMessage(ctx, message._id);
  const values = {
    status: "classified" as const,
    category: getSuppressedCategory(existing?.category),
    importance: 0,
    confidence: 1,
    reason: "Mailing list suppressed by the user",
    summary: (existing?.summary ?? message.snippet).slice(0, 280),
    cleanedMarkdown: existing?.cleanedMarkdown,
    isSpam: true,
    shouldEmbed: false,
    source: "manual" as const,
    promptVersion: "mailing-list-suppression-v1",
    outputSchemaVersion: CLASSIFICATION_OUTPUT_SCHEMA_VERSION,
    jobKey: `suppression:${suppressionId}:${message._id}`,
    inputHash: existing?.inputHash,
    attempt: 0,
    nextAttemptAt: undefined,
    signals: existing?.signals,
    model: undefined,
    error: undefined,
    generateCleanViewAfterClassification: undefined,
    recoveryAttemptedAt: undefined,
    classifiedAt: now,
    updatedAt: now,
  };
  if (existing) {
    await ctx.db.patch(existing._id, values);
  } else {
    await ctx.db.insert("messageClassifications", {
      ownerId: message.ownerId,
      messageId: message._id,
      ...values,
      createdAt: now,
    });
  }
  await reconcileEmbeddingSelection(ctx, message._id);
}

function getSuppressedCategory(category: string | undefined) {
  if (!category || category === "unclassified") return "newsletter" as const;
  if (category === "personal") return "personal" as const;
  if (category === "action_required") return "action_required" as const;
  if (category === "transactional") return "transactional" as const;
  if (category === "newsletter") return "newsletter" as const;
  if (category === "notification") return "notification" as const;
  return "noise" as const;
}

export async function disableMatchingSuppression(
  ctx: MutationCtx,
  message: Doc<"messages">,
  category?: string,
) {
  const suppression = await findMatchingSuppression(ctx, message, category);
  if (!suppression) return false;
  const now = Date.now();
  await ctx.db.patch(suppression._id, { disabledAt: now, updatedAt: now });
  return true;
}
