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

const GMAIL_SYSTEM_LABELS: Record<string, MailFolderKind> = {
  DRAFT: "drafts",
  SENT: "sent",
  SPAM: "junk",
  TRASH: "trash",
};

const HOSTED_LABELS: Record<string, MailFolderKind> = {
  archive: "archive",
  inbox: "inbox",
  junk: "junk",
  sent: "sent",
};

const FLAG_LABELS = new Set(["IMPORTANT", "INBOX", "STARRED", "UNREAD"]);

const HOSTED_FOLDER_PREFIX = "folder:";

/**
 * Where a stored message lives, from what the message itself says. Returns
 * `undefined` when only the account's folder list can tell (Microsoft and
 * iCloud store an opaque folder ID or path as the label).
 */
export function resolveMessageLocation(
  message: LocatableMessage,
  provider: MailProvider,
): MailLocation | undefined {
  if (message.inInbox) return { kind: "inbox" };
  if (message.archivedAt !== undefined) return { kind: "archive" };
  const labels = message.remoteLabelIds ?? [];
  if (provider === "hosted") {
    for (const label of labels) {
      const kind = HOSTED_LABELS[label];
      if (kind && kind !== "inbox") return { kind };
      if (label.startsWith(HOSTED_FOLDER_PREFIX)) {
        const name = label.slice(HOSTED_FOLDER_PREFIX.length).trim();
        if (name) return { kind: "custom", name };
      }
    }
    return fallbackLocation(message);
  }
  if (provider === "gmail") {
    for (const label of labels) {
      const kind = GMAIL_SYSTEM_LABELS[label];
      if (kind) return { kind };
    }
    return undefined;
  }
  return labels.length === 0 ? fallbackLocation(message) : undefined;
}

export function locationFromFolder(
  folder: Pick<Doc<"mailFolders">, "kind" | "name"> | null,
  message: LocatableMessage,
): MailLocation {
  if (!folder || folder.kind === "inbox") return fallbackLocation(message);
  if (folder.kind === "custom") return { kind: "custom", name: folder.name };
  return { kind: folder.kind };
}

export function locationFromICloudPath(path: string): MailLocation {
  const name = path.split("/").at(-1)?.trim() ?? path;
  if (/^(?:junk|spam|bulk mail)$/iu.test(name)) return { kind: "junk" };
  if (/^(?:trash|deleted messages|deleted items|bin)$/iu.test(name)) {
    return { kind: "trash" };
  }
  if (/^sent(?: messages| items| mail)?$/iu.test(name)) return { kind: "sent" };
  if (/^drafts?$/iu.test(name)) return { kind: "drafts" };
  if (/^(?:archive|all mail)$/iu.test(name)) return { kind: "archive" };
  return { kind: "custom", name: path };
}

export async function getMessageLocation(
  ctx: Pick<QueryCtx, "db">,
  message: LocatableMessage & Pick<Doc<"messages">, "accountId">,
  provider: MailProvider,
): Promise<MailLocation> {
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

function fallbackLocation(message: LocatableMessage): MailLocation {
  return message.direction === "outgoing"
    ? { kind: "sent" }
    : { kind: "archive" };
}
