import { z } from "zod";

import type {
  ImportFolderKind,
  ImportSourceMessage,
  MailImportSource,
} from "../types";
import type { GraphCollection } from "./api";
import {
  graphFetch,
  MicrosoftGraphAdapter,
  MicrosoftGraphError,
  parseDate,
} from "./api";

const FOLDER_SELECT = "id,displayName,childFolderCount,totalItemCount";
const MESSAGE_SELECT =
  "id,isRead,isDraft,receivedDateTime,sentDateTime,subject,from";
const MAX_PAGES_PER_CALL = 20;

const FOLDER_KINDS = [
  ["inbox", "inbox"],
  ["sentitems", "sent"],
  ["archive", "archive"],
  ["junkemail", "junk"],
] as const satisfies readonly (readonly [string, ImportFolderKind])[];

// Their subfolders are skipped too.
const SKIPPED_FOLDERS = [
  "deleteditems",
  "drafts",
  "outbox",
  "conversationhistory",
  "syncissues",
  "scheduled",
  "searchfolders",
  "recoverableitemsdeletions",
];

const cursorSchema = z.object({
  folders: z.array(
    z.object({
      id: z.string(),
      path: z.string(),
      kind: z.enum(["inbox", "sent", "archive", "junk", "custom"]),
    }),
  ),
  index: z.number().int().nonnegative(),
  next: z.string().optional(),
});

type ImportCursor = z.infer<typeof cursorSchema>;
type CursorFolder = ImportCursor["folders"][number];

interface GraphImportFolder {
  id?: string;
  displayName?: string;
  childFolderCount?: number;
  totalItemCount?: number;
}

interface GraphImportMessage {
  id?: string;
  isRead?: boolean;
  isDraft?: boolean;
  receivedDateTime?: string;
  sentDateTime?: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
}

export class MicrosoftMailImportSource implements MailImportSource {
  constructor(private readonly accessToken: string) {}

  async listMessages(cursor: string | undefined, limit: number) {
    let estimatedTotal: number | undefined;
    let state: ImportCursor;
    if (cursor) {
      state = cursorSchema.parse(JSON.parse(cursor));
    } else {
      const listing = await listImportFolders(this.accessToken);
      state = { folders: listing.folders, index: 0 };
      estimatedTotal = listing.estimatedTotal;
    }
    for (
      let pages = 0;
      pages < MAX_PAGES_PER_CALL && state.index < state.folders.length;
      pages += 1
    ) {
      const folder = state.folders.at(state.index);
      if (!folder) break;
      const page = await graphFetch<GraphCollection<GraphImportMessage>>(
        this.accessToken,
        state.next ?? folderMessagesPath(folder.id, limit),
      );
      const next = page["@odata.nextLink"];
      state = next
        ? { ...state, next }
        : { folders: state.folders, index: state.index + 1 };
      const messages = (page.value ?? []).flatMap((message) =>
        toImportMessage(message, folder),
      );
      if (messages.length > 0) {
        return { messages, nextCursor: encodeCursor(state), estimatedTotal };
      }
    }
    return { messages: [], nextCursor: encodeCursor(state), estimatedTotal };
  }

  async fetchRawMessage(remoteMessageId: string) {
    return await new MicrosoftGraphAdapter().fetchRawMessage(
      this.accessToken,
      remoteMessageId,
    );
  }
}

export async function listImportFolders(accessToken: string) {
  const wellKnown = await resolveWellKnownFolders(accessToken);
  const folders = new Map<string, CursorFolder & { totalItemCount: number }>();
  const pending = [
    { path: "", url: `/me/mailFolders?$top=100&$select=${FOLDER_SELECT}` },
  ];
  for (
    let collection = pending.shift();
    collection;
    collection = pending.shift()
  ) {
    for (const folder of await listFolderCollection(
      accessToken,
      collection.url,
    )) {
      if (!folder.id || wellKnown.skipped.has(folder.id)) continue;
      const path = folderPath(collection.path, folder.displayName);
      folders.set(folder.id, {
        id: folder.id,
        path,
        kind: wellKnown.kinds.get(folder.id) ?? "custom",
        totalItemCount: folder.totalItemCount ?? 0,
      });
      if ((folder.childFolderCount ?? 0) > 0) {
        pending.push({
          path,
          url: `/me/mailFolders/${encodeURIComponent(folder.id)}/childFolders?$top=100&$select=${FOLDER_SELECT}`,
        });
      }
    }
  }
  const listed = [...folders.values()];
  return {
    folders: listed.map(({ id, path, kind }) => ({ id, path, kind })),
    estimatedTotal: listed.reduce(
      (total, folder) => total + folder.totalItemCount,
      0,
    ),
  };
}

async function listFolderCollection(accessToken: string, url: string) {
  const folders = new Array<GraphImportFolder>();
  const pages = [url];
  for (let next = pages.pop(); next; next = pages.pop()) {
    const page = await graphFetch<GraphCollection<GraphImportFolder>>(
      accessToken,
      next,
    );
    folders.push(...(page.value ?? []));
    const nextLink = page["@odata.nextLink"];
    if (nextLink) pages.push(nextLink);
  }
  return folders;
}

function folderPath(parentPath: string, displayName: string | undefined) {
  const trimmed = displayName?.trim();
  const name = trimmed?.length ? trimmed : "Untitled";
  return parentPath ? `${parentPath}/${name}` : name;
}

async function resolveWellKnownFolder(accessToken: string, name: string) {
  try {
    const folder = await graphFetch<GraphImportFolder>(
      accessToken,
      `/me/mailFolders/${name}?$select=id`,
    );
    return folder.id;
  } catch (error) {
    if (error instanceof MicrosoftGraphError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

async function resolveWellKnownFolders(accessToken: string) {
  const [kinds, skipped] = await Promise.all([
    Promise.all(
      FOLDER_KINDS.map(
        async ([name, kind]) =>
          [await resolveWellKnownFolder(accessToken, name), kind] as const,
      ),
    ),
    Promise.all(
      SKIPPED_FOLDERS.map(
        async (name) => await resolveWellKnownFolder(accessToken, name),
      ),
    ),
  ]);
  return {
    kinds: new Map(
      kinds.flatMap(([id, kind]) => (id ? [[id, kind] as const] : [])),
    ),
    skipped: new Set(skipped.filter((id) => id !== undefined)),
  };
}

function folderMessagesPath(folderId: string, limit: number) {
  return `/me/mailFolders/${encodeURIComponent(folderId)}/messages?$select=${MESSAGE_SELECT}&$top=${limit}`;
}

function toImportMessage(message: GraphImportMessage, folder: CursorFolder) {
  if (!message.id || message.isDraft) return [];
  const received = parseDate(message.receivedDateTime);
  const sent = parseDate(message.sentDateTime);
  return [
    {
      remoteMessageId: message.id,
      folder: { kind: folder.kind, path: folder.path },
      isRead: message.isRead ?? false,
      receivedAt:
        folder.kind === "sent" ? (sent ?? received) : (received ?? sent),
      subject: message.subject,
      from: formatSender(message.from?.emailAddress),
    } satisfies ImportSourceMessage,
  ];
}

function formatSender(sender: { name?: string; address?: string } | undefined) {
  if (!sender?.address) return sender?.name;
  return sender.name ? `${sender.name} <${sender.address}>` : sender.address;
}

function encodeCursor(state: ImportCursor) {
  return state.index < state.folders.length ? JSON.stringify(state) : null;
}
