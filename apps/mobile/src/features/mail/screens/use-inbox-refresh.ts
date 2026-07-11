import { useState } from "react";
import { useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { MobileMailAccount } from "../lib/convex-mail";
import { toConvexId } from "../lib/convex-id";

export function useInboxRefresh(accounts: MobileMailAccount[]) {
  const syncGmailNow = useMutation(api.accounts.mutations.syncGmailNow);
  const syncICloudNow = useMutation(api.accounts.mutations.syncICloudNow);
  const syncMicrosoftNow = useMutation(api.accounts.mutations.syncMicrosoftNow);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string>();

  async function refresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshError(undefined);
    const refreshable = accounts.filter(accountCanSync);
    const results = await Promise.allSettled(
      refreshable.map((account) => {
        const args = { accountId: toConvexId<"mailAccounts">(account.id) };
        if (account.provider === "gmail") return syncGmailNow(args);
        if (account.provider === "icloud") return syncICloudNow(args);
        return syncMicrosoftNow(args);
      }),
    );
    const failedCount = results.filter(isRejected).length;
    const unavailableCount = accounts.filter(accountNeedsReconnect).length;
    const problemCount = failedCount + unavailableCount;
    if (problemCount > 0) setRefreshError(getRefreshError(problemCount));
    setIsRefreshing(false);
  }

  return { isRefreshing, refresh, refreshError };
}

function isRejected(result: PromiseSettledResult<unknown>) {
  return result.status === "rejected";
}

function accountCanSync(account: MobileMailAccount) {
  return (
    !account.isDemo &&
    account.status !== "disconnected" &&
    account.status !== "reauthorization_required" &&
    account.status !== "syncing"
  );
}

function accountNeedsReconnect(account: MobileMailAccount) {
  return (
    !account.isDemo &&
    (account.status === "disconnected" ||
      account.status === "reauthorization_required")
  );
}

function getRefreshError(count: number) {
  if (count === 1) return "1 account needs attention. Check Settings.";
  return `${count} accounts need attention. Check Settings.`;
}
