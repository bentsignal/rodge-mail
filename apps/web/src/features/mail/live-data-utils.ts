import {
  dedupeThreadRows,
  sortPinnedMailRows,
} from "@rodge-mail/features/mail";

import type { MailAccountDocument } from "./types";

export function toAccountView(account: MailAccountDocument) {
  const providerLabel = getNonemptyValue(account.displayName, account.address);
  const accountLabel = getNonemptyValue(account.displayLabel, providerLabel);
  const isDemo =
    account.isDemo === true || account.remoteAccountId.startsWith("demo-");
  const label = isDemo ? `${accountLabel} · Demo` : accountLabel;
  return {
    ...account,
    initials: getInitials(label),
    label,
  };
}

export function sortInboxMessages<
  T extends { isPinned: boolean; receivedAt: number; threadId: string },
>(messages: T[]) {
  return dedupeThreadRows(sortPinnedMailRows(messages));
}

export function toUnreadCountRecord(summary: {
  all: number;
  byAccount: Record<string, number>;
}) {
  return { all: summary.all, ...summary.byAccount };
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

function getNonemptyValue(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  if (normalized) return normalized;
  return fallback;
}
