export type MailLocationKind =
  | "archive"
  | "custom"
  | "drafts"
  | "inbox"
  | "junk"
  | "sent"
  | "trash";

export interface MailLocation {
  kind: MailLocationKind;
  name?: string;
}

const LOCATION_LABELS = {
  archive: "Archive",
  custom: "Folder",
  drafts: "Drafts",
  inbox: "Inbox",
  junk: "Junk",
  sent: "Sent",
  trash: "Trash",
} satisfies Record<MailLocationKind, string>;

export function getMailLocationLabel(location: MailLocation) {
  return location.name?.trim() || LOCATION_LABELS[location.kind];
}

/** "Account · Folder" for rows outside the inbox; the account alone when asked. */
export function getMailLocationTag({
  accountLabel,
  location,
  showAccount,
}: {
  accountLabel: string | undefined;
  location: MailLocation | undefined;
  showAccount: boolean;
}) {
  const parts = [];
  if (showAccount && accountLabel) parts.push(accountLabel);
  if (location && location.kind !== "inbox") {
    parts.push(getMailLocationLabel(location));
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export type MailThreadPlacement = "archived" | "elsewhere" | "inbox";

export function getMailThreadPlacement({
  archivedAt,
  inInbox,
}: {
  archivedAt?: number;
  inInbox?: boolean;
}): MailThreadPlacement {
  if (inInbox !== false) return "inbox";
  if (archivedAt !== undefined) return "archived";
  return "elsewhere";
}

/**
 * Rodge can move a thread into the inbox when it archived it itself, or when
 * the mailbox is hosted and Rodge holds the only copy. Gmail, Microsoft, and
 * iCloud own their folders.
 */
export function canMoveMailThreadToInbox({
  archivedAt,
  inInbox,
  provider,
}: {
  archivedAt?: number;
  inInbox?: boolean;
  provider: string;
}) {
  if (inInbox !== false) return false;
  return archivedAt !== undefined || provider === "hosted";
}
