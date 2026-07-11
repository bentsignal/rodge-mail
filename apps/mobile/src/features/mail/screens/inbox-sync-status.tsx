import { Text } from "react-native";

import type { MobileMailAccount } from "../lib/convex-mail";

export function InboxSyncStatus({
  accounts,
  error,
}: {
  accounts: MobileMailAccount[];
  error: string | undefined;
}) {
  const syncingCount = accounts.filter(
    (account) => account.status === "syncing",
  ).length;
  const attentionCount = accounts.filter(accountNeedsAttention).length;

  if (error) {
    return (
      <Text className="text-destructive px-4 text-sm leading-5">{error}</Text>
    );
  }
  if (attentionCount > 0) {
    return (
      <Text className="text-destructive px-4 text-sm leading-5">
        {getAttentionLabel(attentionCount)}
      </Text>
    );
  }
  if (syncingCount === 0) return null;
  return (
    <Text className="text-muted-foreground px-4 text-sm">
      {getSyncingLabel(syncingCount)}
    </Text>
  );
}

function getSyncingLabel(count: number) {
  if (count === 1) return "Syncing account…";
  return `Syncing ${count} accounts…`;
}

function getAttentionLabel(count: number) {
  if (count === 1) return "1 account needs attention. Check Settings.";
  return `${count} accounts need attention. Check Settings.`;
}

function accountNeedsAttention(account: MobileMailAccount) {
  return (
    !account.isDemo &&
    (account.status === "disconnected" ||
      account.status === "error" ||
      account.status === "reauthorization_required")
  );
}
