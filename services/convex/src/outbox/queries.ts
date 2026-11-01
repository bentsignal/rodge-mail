import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { AuthedQueryCtx } from "../utils";
import { getActiveAccount } from "../mail/helpers";
import { authedQuery } from "../utils";
import {
  MAX_RECENT_OUTBOX_PER_UNRESOLVED_STATUS,
  MAX_RECENT_SENT_OUTBOX,
  mergeRecentOutboxes,
} from "./recent";
import {
  canOpenStoredMessage,
  getAccountLabel,
  getSentAttachmentCount,
  toSentAttachment,
  toSentSnippet,
} from "./sent";

const UNRESOLVED_STATUSES = ["pending", "sending", "failed"] as const;

export const listRecent = authedQuery({
  args: {},
  handler: async (ctx) => {
    const unresolvedGroups = await listUnresolvedGroups(ctx);
    const sent = await ctx.db
      .query("outboxMessages")
      .withIndex("by_owner_status_created", (q) =>
        q.eq("ownerId", ctx.ownerId).eq("status", "sent"),
      )
      .order("desc")
      .take(MAX_RECENT_SENT_OUTBOX);
    const outboxes = mergeRecentOutboxes([...unresolvedGroups, sent]);
    const rows = await Promise.all(
      outboxes.map(async (outbox) => {
        const account = await getActiveAccount(ctx, outbox.accountId);
        if (!account || account.ownerId !== ctx.ownerId) return undefined;
        return {
          _id: outbox._id,
          account: {
            address: account.address,
            provider: account.provider,
          },
          attempt: outbox.attempt,
          createdAt: outbox.createdAt,
          error: outbox.error,
          sentAt: outbox.sentAt,
          status: outbox.status,
          subject: outbox.subject,
          to: outbox.to,
          updatedAt: outbox.updatedAt,
        };
      }),
    );
    return rows.flatMap((row) => (row ? [row] : []));
  },
});

/** Queued, sending, and failed mail, newest first. */
export const listUnsent = authedQuery({
  args: {},
  handler: async (ctx) => {
    const outboxes = mergeRecentOutboxes(await listUnresolvedGroups(ctx));
    return await toSentRows(ctx, outboxes);
  },
});

/** Delivered mail, newest first. */
export const listSent = authedQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("outboxMessages")
      .withIndex("by_owner_status_created", (q) =>
        q.eq("ownerId", ctx.ownerId).eq("status", "sent"),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: await toSentRows(ctx, result.page) };
  },
});

/** Everything that was sent, or is waiting to be, for the sent-message view. */
export const getSentMessage = authedQuery({
  args: { outboxId: v.id("outboxMessages") },
  handler: async (ctx, args) => {
    const outbox = await ctx.db.get(args.outboxId);
    if (outbox?.ownerId !== ctx.ownerId) return null;
    const row = await toSentRow(ctx, outbox);
    if (!row) return null;
    return {
      ...row,
      attachments: await getAttachments(ctx, outbox),
      bcc: outbox.bcc,
      plainText: outbox.plainText,
    };
  },
});

async function listUnresolvedGroups(ctx: AuthedQueryCtx) {
  return await Promise.all(
    UNRESOLVED_STATUSES.map(
      async (status) =>
        await ctx.db
          .query("outboxMessages")
          .withIndex("by_owner_status_created", (q) =>
            q.eq("ownerId", ctx.ownerId).eq("status", status),
          )
          .order("desc")
          .take(MAX_RECENT_OUTBOX_PER_UNRESOLVED_STATUS),
    ),
  );
}

async function toSentRows(
  ctx: AuthedQueryCtx,
  outboxes: Doc<"outboxMessages">[],
) {
  const rows = await Promise.all(
    outboxes.map(async (outbox) => await toSentRow(ctx, outbox)),
  );
  return rows.flatMap((row) => (row ? [row] : []));
}

async function toSentRow(ctx: AuthedQueryCtx, outbox: Doc<"outboxMessages">) {
  const account = await getActiveAccount(ctx, outbox.accountId);
  if (!account || account.ownerId !== ctx.ownerId) return undefined;
  const message = await findStoredMessage(ctx, outbox);
  return {
    _id: outbox._id,
    account: {
      _id: account._id,
      address: account.address,
      label: getAccountLabel(account),
      provider: account.provider,
    },
    attachmentCount: getSentAttachmentCount(outbox),
    attempt: outbox.attempt,
    cc: outbox.cc,
    createdAt: outbox.createdAt,
    error: outbox.error,
    messageId: message?._id,
    sentAt: outbox.sentAt,
    snippet: toSentSnippet(outbox.plainText),
    status: outbox.status,
    subject: outbox.subject,
    threadId: message?.threadId,
    to: outbox.to,
    updatedAt: outbox.updatedAt,
  };
}

async function findStoredMessage(
  ctx: AuthedQueryCtx,
  outbox: Doc<"outboxMessages">,
) {
  const remoteMessageId = outbox.remoteMessageId;
  if (outbox.status !== "sent" || !remoteMessageId) return undefined;
  const message = await ctx.db
    .query("messages")
    .withIndex("by_account_remote", (q) =>
      q
        .eq("accountId", outbox.accountId)
        .eq("remoteMessageId", remoteMessageId),
    )
    .first();
  return canOpenStoredMessage(outbox, message) ? message : undefined;
}

async function getAttachments(
  ctx: AuthedQueryCtx,
  outbox: Doc<"outboxMessages">,
) {
  if (outbox.sentAttachments) {
    return outbox.sentAttachments.map((attachment) => ({
      ...attachment,
      url: undefined,
    }));
  }
  const drafts = await Promise.all(
    (outbox.attachmentIds ?? []).map(async (id) => await ctx.db.get(id)),
  );
  return await Promise.all(
    drafts
      .filter(
        (draft): draft is NonNullable<typeof draft> =>
          draft?.ownerId === ctx.ownerId && draft.outboxId === outbox._id,
      )
      .map(async (draft) => ({
        ...toSentAttachment(draft),
        url: draft.storageId
          ? ((await ctx.storage.getUrl(draft.storageId)) ?? undefined)
          : undefined,
      })),
  );
}
