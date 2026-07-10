import type { MailAccountFilter } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";
import type { NativeComposerAttachment } from "./use-native-attachments";

export type ComposerFieldName = "bcc" | "body" | "cc" | "subject" | "to";

export function createComposerDraft({
  subject,
  to,
}: {
  subject?: string;
  to?: string;
}) {
  return {
    attachments: new Array<NativeComposerAttachment>(),
    bcc: "",
    body: "",
    cc: "",
    subject: subject ?? "",
    to: to ?? "",
  };
}

export function getSelectedAccount(
  accounts: MobileMailAccount[],
  selectedAccountId: string | undefined,
  accountFilter: MailAccountFilter,
) {
  return (
    accounts.find((account) => account.id === selectedAccountId) ??
    accounts.find((account) => account.id === accountFilter) ??
    accounts[0]
  );
}

export function canSendFromAccount(account: MobileMailAccount) {
  return (
    ["gmail", "icloud", "microsoft"].includes(account.provider) &&
    ["connected", "syncing"].includes(account.status)
  );
}

export function draftCanSend(draft: {
  attachments: NativeComposerAttachment[];
  body: string;
  to: string;
}) {
  return (
    draft.to.trim().length > 0 &&
    draft.body.trim().length > 0 &&
    draft.attachments.every((attachment) => attachment.status === "ready")
  );
}

export function parseAddresses(value: string) {
  return value
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter((address) => address.includes("@"))
    .map((address) => ({ address }));
}

export function getComposerErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Rodge Mail could not add this message to the delivery queue.";
}
