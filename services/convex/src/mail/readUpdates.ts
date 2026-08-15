import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";

export function scheduleProviderReadUpdate({
  ctx,
  ownerId,
  account,
  message,
  isRead,
  delay,
}: {
  ctx: Pick<MutationCtx, "scheduler">;
  ownerId: string;
  account: Doc<"mailAccounts"> | null;
  message: Doc<"messages">;
  isRead: boolean;
  delay: number;
}) {
  if (account?.ownerId !== ownerId || account.isDemo) {
    return undefined;
  }
  const args = {
    ownerId,
    accountId: account._id,
    remoteMessageId: message.remoteMessageId,
    isRead,
  };
  if (account.provider === "gmail") {
    return ctx.scheduler.runAfter(
      delay,
      internal.sync.internal.setGmailMessageRead,
      args,
    );
  }
  if (account.provider === "microsoft") {
    return ctx.scheduler.runAfter(
      delay,
      internal.sync.internal.setMicrosoftMessageRead,
      args,
    );
  }
  return ctx.scheduler.runAfter(
    delay,
    internal.providers.icloud.outbox.setRead,
    args,
  );
}
