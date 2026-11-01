import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { DemoMessage } from "./devSeedFixtures";

export function isDemoInboxMessage(fixture: Pick<DemoMessage, "placement">) {
  return fixture.placement !== "archive" && fixture.placement !== "folder";
}

export async function ensureDemoThread({
  ctx,
  ownerId,
  accountId,
  fixture,
  now,
}: {
  ctx: MutationCtx;
  ownerId: string;
  accountId: Id<"mailAccounts">;
  fixture: DemoMessage;
  now: number;
}) {
  const archivedAt =
    fixture.placement === "archive" ? fixture.receivedAt : undefined;
  const inInbox = isDemoInboxMessage(fixture);
  const unread = fixture.isRead ? 0 : 1;
  const existing = await ctx.db
    .query("threads")
    .withIndex("by_account_remote", (q) =>
      q.eq("accountId", accountId).eq("remoteThreadId", fixture.remoteThreadId),
    )
    .first();
  if (existing) {
    const isLatest = fixture.receivedAt > existing.latestMessageAt;
    await ctx.db.patch(existing._id, {
      messageCount: existing.messageCount + 1,
      unreadCount: existing.unreadCount + unread,
      isPinned: existing.isPinned === true || fixture.isPinned,
      hasAttachments:
        existing.hasAttachments || fixture.attachment !== undefined,
      ...(isLatest
        ? {
            subject: fixture.subject,
            snippet: fixture.snippet,
            latestMessageAt: fixture.receivedAt,
            ...(inInbox ? { latestInboxMessageAt: fixture.receivedAt } : {}),
          }
        : {}),
      updatedAt: now,
    });
    return existing._id;
  }

  return await ctx.db.insert("threads", {
    ownerId,
    accountId,
    remoteThreadId: fixture.remoteThreadId,
    subject: fixture.subject,
    snippet: fixture.snippet,
    participants: [fixture.from],
    latestMessageAt: fixture.receivedAt,
    ...(inInbox ? { latestInboxMessageAt: fixture.receivedAt } : {}),
    messageCount: 1,
    unreadCount: unread,
    inInbox,
    isPinned: fixture.isPinned,
    ...(archivedAt === undefined ? {} : { archivedAt }),
    hasAttachments: fixture.attachment !== undefined,
    createdAt: now,
    updatedAt: now,
  });
}
