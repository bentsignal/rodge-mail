import { useState } from "react";
import { useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";
import { toast } from "@rodge-mail/ui-web/toast";

import type { MailAccountView } from "./types";
import { getErrorMessage } from "./live-data-utils";

export function useSyncAll(accounts: MailAccountView[]) {
  const syncAllNow = useMutation(api.accounts.mutations.syncAllNow);
  const [isRequestingSync, setIsRequestingSync] = useState(false);

  async function syncAllAccounts() {
    if (isRequestingSync) return;
    setIsRequestingSync(true);
    try {
      const result = await syncAllNow({});
      showSyncResult(result.scheduled);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not refresh your accounts."));
    }
    setIsRequestingSync(false);
  }

  return {
    isSyncingAccounts:
      isRequestingSync ||
      accounts.some((account) => account.status === "syncing"),
    syncAllAccounts,
  };
}

function showSyncResult(scheduled: number) {
  if (scheduled === 0) {
    toast.info("No connected accounts are available to sync.");
    return;
  }
  toast.success(
    `Refreshing ${scheduled} account${scheduled === 1 ? "" : "s"}.`,
  );
}
