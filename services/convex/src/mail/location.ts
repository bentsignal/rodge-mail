import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { MailFolderKind, MailProvider } from "./types";

export interface MailLocation {
  kind: MailFolderKind;
  name?: string;
}

type LocatableMessage = Pick<
  Doc<"messages">,
  "archivedAt" | "direction" | "hiddenAt" | "inInbox" | "remoteLabelIds"
>;

const GMAIL_SYSTEM_LABELS = new Map<string, MailFolderKind>([
  ["DRAFT", "drafts"],
  ["SENT", "sent"],
  ["SPAM", "junk"],
  ["TRASH", "trash"],
]);

const HOSTED_LABELS = new Map<string, MailFolderKind>([
  ["archive", "archive"],
  ["junk", "junk"],
  ["sent", "sent"],
]);

const FLAG_LABELS = new Set(["IMPORTANT", "INBOX", "STARRED", "UNREAD"]);

const HOSTED_FOLDER_PREFIX = "folder:";

function toLocation(kind: MailFolderKind, name?: string) {
  return name === undefined ? { kind } : { kind, name };
}

/**
 * Where a stored message lives, from what the message itself says. Returns
 * `undefined` when only the account's folder list can tell (Microsoft and
 * iCloud store an opaque folder ID or path as the label).
 */
export function resolveMessageLocation(
  message: LocatableMessage,
  provider: MailProvider,
) {
  if (message.inInbox) return toLocation("inbox");
  if (message.archivedAt !== undefined) return toLocation("archive");
  const labels = message.remoteLabelIds ?? [];
  if (provider === "hosted") return resolveHostedLocation(message, labels);
  if (provider === "gmail") return resolveGmailLocation(labels);
  return labels.length === 0 ? fallbackLocation(message) : undefined;
}

function resolveHostedLocation(message: LocatableMessage, labels: string[]) {
  for (const label of labels) {
    const kind = HOSTED_LABELS.get(label);
    if (kind) return toLocation(kind);
    if (label.startsWith(HOSTED_FOLDER_PREFIX)) {
      const name = label.slice(HOSTED_FOLDER_PREFIX.length).trim();
      if (name) return toLocation("custom", name);
    }
  }
  return fallbackLocation(message);
}

function resolveGmailLocation(labels: string[]) {
  for (const label of labels) {
    const kind = GMAIL_SYSTEM_LABELS.get(label);
    if (kind) return toLocation(kind);
  }
  return undefined;
}

export function locationFromFolder(
  folder: Pick<Doc<"mailFolders">, "kind" | "name"> | null,
  message: LocatableMessage,
) {
  if (!folder || folder.kind === "inbox") return fallbackLocation(message);
  if (folder.kind === "custom") return toLocation("custom", folder.name);
  return toLocation(folder.kind);
}

export function locationFromICloudPath(path: string) {
  const name = path.split("/").at(-1)?.trim() ?? path;
  if (/^(?:junk|spam|bulk mail)$/iu.test(name)) return toLocation("junk");
  if (/^(?:trash|deleted messages|deleted items|bin)$/iu.test(name)) {
    return toLocation("trash");
  }
  if (/^sent(?: messages| items| mail)?$/iu.test(name)) {
    return toLocation("sent");
  }
  if (/^drafts?$/iu.test(name)) return toLocation("drafts");
  if (/^(?:archive|all mail)$/iu.test(name)) return toLocation("archive");
  return toLocation("custom", path);
}

export async function getMessageLocation(
  ctx: Pick<QueryCtx, "db">,
  message: LocatableMessage & Pick<Doc<"messages">, "accountId">,
  provider: MailProvider,
) {
  const known = resolveMessageLocation(message, provider);
  if (known) return known;
  const label = message.remoteLabelIds?.find(
    (value) => !value.startsWith("CATEGORY_") && !FLAG_LABELS.has(value),
  );
  if (!label) return fallbackLocation(message);
  const folder = await ctx.db
    .query("mailFolders")
    .withIndex("by_account_remote", (q) =>
      q.eq("accountId", message.accountId).eq("remoteFolderId", label),
    )
    .first();
  if (!folder && provider === "icloud") return locationFromICloudPath(label);
  return locationFromFolder(folder, message);
}

/** Junk, trash, and hidden repairs stay out of All Mail and search. */
export function isAllMailLocation(
  message: Pick<Doc<"messages">, "hiddenAt">,
  location: MailLocation,
) {
  return (
    message.hiddenAt === undefined &&
    location.kind !== "junk" &&
    location.kind !== "trash"
  );
}

function fallbackLocation(message: LocatableMessage) {
  return toLocation(message.direction === "outgoing" ? "sent" : "archive");
}
