import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { AuthedMutationCtx } from "../utils";
import { createMessageSearchText } from "../mail/search";
import { authedMutation } from "../utils";
import { reconcileEmbeddingSelection } from "./internal";
import {
  embeddingSelectionPlan,
  findEmbeddingJob,
  findMessageEmbedding,
} from "./storage";

const BACKFILL_BATCH_SIZE = 25;
const INDEXING_STAT_KEYS = [
  "embeddingsNeedingCleanup",
  "importantMessages",
  "jobsNeedingCleanup",
  "missingEmbeddings",
  "missingImportantEmbeddings",
  "searchTextsNeedingUpdate",
] as const;

type IndexingStat = (typeof INDEXING_STAT_KEYS)[number];
type IndexingStats = Record<IndexingStat, number>;

export const backfillInboxIndexing = authedMutation({
  args: {
    apply: v.boolean(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("messages")
      .withIndex("by_owner_inbox_received", (q) =>
        q.eq("ownerId", ctx.ownerId).eq("inInbox", true),
      )
      .order("desc")
      .paginate({ cursor: args.cursor, numItems: BACKFILL_BATCH_SIZE });

    const stats = emptyIndexingStats();
    for (const message of batch.page) {
      const messageStats = await processInboxMessage(ctx, message, args.apply);
      for (const key of INDEXING_STAT_KEYS) stats[key] += messageStats[key];
    }

    return {
      continueCursor: batch.continueCursor,
      isDone: batch.isDone,
      applied: args.apply,
      ...stats,
      processed: batch.page.length,
    };
  },
});

async function processInboxMessage(
  ctx: AuthedMutationCtx,
  message: Doc<"messages">,
  apply: boolean,
) {
  const [account, classification, content, embedding, job] = await Promise.all([
    ctx.db.get(message.accountId),
    ctx.db
      .query("messageClassifications")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .first(),
    ctx.db
      .query("messageContents")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .first(),
    findMessageEmbedding(ctx, message._id),
    findEmbeddingJob(ctx, message._id),
  ]);
  const ownedAccount = getOwnedAccount(account, ctx.ownerId);
  if (!ownedAccount) return emptyIndexingStats();
  const searchText = createMessageSearchText({
    accountAddress: ownedAccount.address,
    body: content?.plainText,
    cc: message.cc,
    from: message.from,
    snippet: message.snippet,
    subject: message.subject,
    to: message.to,
  });
  const plan = embeddingSelectionPlan({
    clearSelected: false,
    embeddingReason: embedding?.reason,
    importance: classification?.importance,
    inInbox: message.inInbox,
    isPinned: message.isPinned,
    jobReason: job?.reason,
  });
  const isEligible = embeddingIsEligible(plan);
  const stats = createIndexingStats({
    embeddingReason: embedding?.reason,
    hasEmbedding: embedding !== null,
    isEligible,
    jobReason: job?.reason,
    planDeleteReason: plan.deleteReason,
    searchTextNeedsUpdate: searchText !== message.searchText,
  });
  await applyIndexingUpdate(ctx, message, searchText, apply);
  return stats;
}

async function applyIndexingUpdate(
  ctx: AuthedMutationCtx,
  message: Doc<"messages">,
  searchText: string,
  apply: boolean,
) {
  if (!apply) return;
  if (searchText !== message.searchText) {
    await ctx.db.patch(message._id, { searchText });
  }
  await reconcileEmbeddingSelection(ctx, message._id);
}

function embeddingIsEligible(plan: ReturnType<typeof embeddingSelectionPlan>) {
  return plan.preserveSelected || plan.reason !== null;
}

function getOwnedAccount(account: Doc<"mailAccounts"> | null, ownerId: string) {
  if (account?.ownerId !== ownerId) return undefined;
  return account;
}

function createIndexingStats(args: {
  embeddingReason: string | undefined;
  hasEmbedding: boolean;
  isEligible: boolean;
  jobReason: string | undefined;
  planDeleteReason: string | undefined;
  searchTextNeedsUpdate: boolean;
}) {
  return {
    embeddingsNeedingCleanup: Number(
      args.planDeleteReason !== undefined &&
        args.embeddingReason === args.planDeleteReason,
    ),
    importantMessages: Number(args.isEligible),
    jobsNeedingCleanup: Number(
      args.planDeleteReason !== undefined &&
        args.jobReason === args.planDeleteReason,
    ),
    missingEmbeddings: Number(!args.hasEmbedding),
    missingImportantEmbeddings: Number(args.isEligible && !args.hasEmbedding),
    searchTextsNeedingUpdate: Number(args.searchTextNeedsUpdate),
  } satisfies IndexingStats;
}

function emptyIndexingStats() {
  return {
    embeddingsNeedingCleanup: 0,
    importantMessages: 0,
    jobsNeedingCleanup: 0,
    missingEmbeddings: 0,
    missingImportantEmbeddings: 0,
    searchTextsNeedingUpdate: 0,
  } satisfies IndexingStats;
}
