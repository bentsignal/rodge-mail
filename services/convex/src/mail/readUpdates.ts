import type { Doc } from "../_generated/dataModel";
import type { AuthedMutationCtx } from "../utils";
import { internal } from "../_generated/api";

export function scheduleProviderReadUpdate({
  ctx,
  account,
  message,
  isRead,
  delay,
}: {
  ctx: AuthedMutationCtx;
  account: Doc<"mailAccounts"> | null;
  message: Doc<"messages">;
  isRead: boolean;
  delay: number;
}) {
  if (!account || account.ownerId !== ctx.ownerId || account.isDemo) {
    return undefined;
  }
  const args = {
    ownerId: ctx.ownerId,
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
