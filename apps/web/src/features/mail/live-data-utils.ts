import { dedupeThreadRows } from "@rodge-mail/features/mail";

import type { InboxMessage, MailAccountDocument } from "./types";

const ACCOUNT_ACCENTS = {
  gmail: "#c95d3f",
  icloud: "#b38736",
  microsoft: "#397367",
} as const;

export function toAccountView(account: MailAccountDocument) {
  const accountLabel = account.displayName?.trim() ?? account.address;
  const isDemo =
    account.isDemo === true || account.remoteAccountId.startsWith("demo-");
  const label = isDemo ? `${accountLabel} · Demo` : accountLabel;
  return {
    ...account,
    accent: ACCOUNT_ACCENTS[account.provider],
    initials: getInitials(label),
    label,
  };
}

export function sortInboxMessages(messages: InboxMessage[]) {
  const sortedMessages = messages.slice().sort((left, right) => {
    return right.receivedAt - left.receivedAt;
  });
  return dedupeThreadRows(sortedMessages);
}

export function getLoadedUnreadCounts(messages: InboxMessage[]) {
  const counts = new Map<string, number>([["all", 0]]);
  for (const message of messages) {
    if (message.isRead) continue;
    counts.set("all", (counts.get("all") ?? 0) + 1);
    counts.set(message.accountId, (counts.get(message.accountId) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getInitials(value: string) {
  const segments = value.split(/\s+|@/).filter(Boolean);
  return segments
    .slice(0, 2)
    .map((segment) => segment[0]?.toLocaleUpperCase())
    .join("");
}
