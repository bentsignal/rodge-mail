/* eslint-disable complexity, max-lines, no-restricted-syntax, @typescript-eslint/consistent-type-assertions -- Microsoft Graph pagination and external response normalization require explicit boundary code. */
import type {
  MailProviderAdapter,
  NormalizedAttachment,
  NormalizedFolder,
  NormalizedMessage,
  OutboxPayload,
} from "../types";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const INITIAL_SYNC_LOOKBACK_DAYS = 90;
const MAX_DELTA_PAGES = 100;
const SIMPLE_ATTACHMENT_LIMIT_BYTES = 3 * 1024 * 1024;
const GRAPH_PREFERENCES =
  'IdType="ImmutableId", outlook.body-content-type="text", odata.maxpagesize=200';
const MESSAGE_SELECT = [
  "id",
  "conversationId",
  "internetMessageId",
  "subject",
  "body",
  "bodyPreview",
  "from",
  "replyTo",
  "toRecipients",
  "ccRecipients",
  "bccRecipients",
  "receivedDateTime",
  "sentDateTime",
  "isRead",
  "isDraft",
  "hasAttachments",
  "parentFolderId",
  "internetMessageHeaders",
].join(",");

export class MicrosoftGraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "MicrosoftGraphError";
  }
}

export class MicrosoftGraphAdapter implements MailProviderAdapter {
  async fullSync(accessToken: string) {
    const [folders, delta] = await Promise.all([
      listFolders(accessToken),
      collectDelta(accessToken, initialDeltaUrl()),
    ]);
    return {
      cursor: delta.cursor,
      folders,
      messages: delta.messages,
    };
  }

  async incrementalSync(accessToken: string, cursor: string) {
    const delta = await collectDelta(accessToken, validateDeltaUrl(cursor));
    return {
      cursor: delta.cursor,
      deletedRemoteMessageIds: delta.deletedRemoteMessageIds,
      messages: delta.messages,
    };
  }

  async sendPlainText(
    accessToken: string,
    payload: OutboxPayload,
    onDraftCreated?: (remoteMessageId: string) => Promise<void>,
  ) {
    if (payload.remoteMessageId) {
      return await resumeDraftSend(
        accessToken,
        payload.remoteMessageId,
        payload,
      );
    }

    const draft = await graphFetch<GraphMessage>(accessToken, "/me/messages", {
      method: "POST",
      body: JSON.stringify(createDraftPayload(payload)),
    });
    if (!draft.id) throw new Error("Microsoft Graph omitted the draft ID");
    await onDraftCreated?.(draft.id);
    await sendDraft(accessToken, draft.id);
    return { remoteMessageId: draft.id };
  }

  async sendMessage(accessToken: string, payload: OutboxPayload) {
    return await this.sendPlainText(accessToken, payload);
  }

  async fetchAttachment(
    accessToken: string,
    remoteMessageId: string,
    remoteAttachmentId: string,
  ) {
    return await graphFetchBytes(
      accessToken,
      `/me/messages/${encodeURIComponent(remoteMessageId)}/attachments/${encodeURIComponent(remoteAttachmentId)}/$value`,
    );
  }

  async setRead(accessToken: string, remoteMessageId: string, isRead: boolean) {
    await graphFetch<GraphMessage>(
      accessToken,
      `/me/messages/${encodeURIComponent(remoteMessageId)}?$select=id,isRead`,
      {
        method: "PATCH",
        body: JSON.stringify({ isRead }),
      },
    );
  }
}

async function collectDelta(accessToken: string, initialUrl: string) {
  const messages = new Map<string, NormalizedMessage>();
  const deleted = new Set<string>();
  let nextUrl: string | undefined = initialUrl;
  let cursor: string | undefined;
  let pageCount = 0;

  while (nextUrl) {
    pageCount += 1;
    if (pageCount > MAX_DELTA_PAGES) {
      throw new Error("Microsoft inbox delta exceeded the safe page limit");
    }
    const page: GraphCollection<GraphMessage> = await graphFetch<
      GraphCollection<GraphMessage>
    >(accessToken, nextUrl);
    for (const message of page.value ?? []) {
      if (!message.id) continue;
      if (message["@removed"]) {
        messages.delete(message.id);
        deleted.add(message.id);
        continue;
      }
      messages.set(message.id, normalizeMessage(message));
      deleted.delete(message.id);
    }
    nextUrl = page["@odata.nextLink"]
      ? validateDeltaUrl(page["@odata.nextLink"])
      : undefined;
    if (page["@odata.deltaLink"]) {
      cursor = validateDeltaUrl(page["@odata.deltaLink"]);
    }
  }
  if (!cursor) throw new Error("Microsoft Graph omitted the inbox delta link");
  return {
    cursor,
    deletedRemoteMessageIds: [...deleted],
    messages: [...messages.values()],
  };
}

async function listFolders(accessToken: string) {
  const folders = new Map<string, NormalizedFolder>();
  const pendingCollections = [
    "/me/mailFolders?includeHiddenFolders=true&$top=100&$select=id,displayName,childFolderCount",
  ];
  while (pendingCollections.length > 0) {
    let nextUrl: string | undefined = pendingCollections.shift();
    while (nextUrl) {
      const page: GraphCollection<GraphFolder> = await graphFetch<
        GraphCollection<GraphFolder>
      >(accessToken, nextUrl);
      for (const folder of page.value ?? []) {
        if (!folder.id || !folder.displayName) continue;
        folders.set(folder.id, {
          remoteFolderId: folder.id,
          name: folder.displayName,
          kind: "custom",
        });
        if ((folder.childFolderCount ?? 0) > 0) {
          pendingCollections.push(
            `/me/mailFolders/${encodeURIComponent(folder.id)}/childFolders?includeHiddenFolders=true&$top=100&$select=id,displayName,childFolderCount`,
          );
        }
      }
      nextUrl = page["@odata.nextLink"]
        ? validateGraphUrl(page["@odata.nextLink"])
        : undefined;
    }
  }

  for (const [wellKnownName, kind] of WELL_KNOWN_FOLDERS) {
    try {
      const folder = await graphFetch<GraphFolder>(
        accessToken,
        `/me/mailFolders/${wellKnownName}?$select=id,displayName`,
      );
      if (folder.id) {
        folders.set(folder.id, {
          remoteFolderId: folder.id,
          name: folder.displayName ?? wellKnownName,
          kind,
        });
      }
    } catch (error) {
      if (!(error instanceof MicrosoftGraphError && error.status === 404)) {
        throw error;
      }
    }
  }
  return [...folders.values()];
}

async function resumeDraftSend(
  accessToken: string,
  remoteMessageId: string,
  payload: OutboxPayload,
) {
  for (const waitMs of [0, 1_000, 2_000]) {
    if (waitMs > 0) await delay(waitMs);
    const existing = await getMessageState(accessToken, remoteMessageId);
    if (!existing) continue;
    if (!existing.isDraft) return { remoteMessageId };
    await sendDraft(accessToken, remoteMessageId);
    return { remoteMessageId };
  }
  throw new Error(
    `Microsoft is still reconciling the queued message ${payload._id}`,
  );
}

async function sendDraft(accessToken: string, remoteMessageId: string) {
  try {
    await graphFetch<void>(
      accessToken,
      `/me/messages/${encodeURIComponent(remoteMessageId)}/send`,
      { method: "POST" },
    );
  } catch (error) {
    if (error instanceof MicrosoftGraphError && error.status < 500) throw error;
    await delay(1_500);
    const existing = await getMessageState(accessToken, remoteMessageId);
    if (existing && !existing.isDraft) return;
    throw error;
  }
}

async function getMessageState(accessToken: string, remoteMessageId: string) {
  try {
    return await graphFetch<Pick<GraphMessage, "id" | "isDraft">>(
      accessToken,
      `/me/messages/${encodeURIComponent(remoteMessageId)}?$select=id,isDraft`,
    );
  } catch (error) {
    if (error instanceof MicrosoftGraphError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

function createDraftPayload(payload: OutboxPayload) {
  for (const attachment of payload.attachments) {
    if (attachment.size > SIMPLE_ATTACHMENT_LIMIT_BYTES) {
      throw new Error(
        `${attachment.fileName} exceeds Microsoft Graph's 3 MB simple attachment limit`,
      );
    }
  }
  return {
    subject: payload.subject,
    body: { contentType: "Text", content: payload.plainText },
    toRecipients: toRecipients(payload.to),
    ccRecipients: toRecipients(payload.cc),
    bccRecipients: toRecipients(payload.bcc),
    internetMessageHeaders: [
      {
        name: "x-rodge-mail-idempotency-key",
        value: String(payload._id),
      },
    ],
    attachments: payload.attachments.map((attachment) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: attachment.fileName,
      contentType: attachment.contentType,
      contentBytes: encodeBase64(attachment.bytes),
    })),
  };
}

function normalizeMessage(message: GraphMessage): NormalizedMessage {
  if (!message.id) throw new Error("Microsoft message omitted its ID");
  const receivedAt = parseDate(message.receivedDateTime) ?? Date.now();
  const headers = (message.internetMessageHeaders ?? []).flatMap((header) =>
    header.name && header.value !== undefined
      ? [{ name: header.name, value: header.value }]
      : [],
  );
  const attachments = (message.attachments ?? []).flatMap(normalizeAttachment);
  return {
    remoteMessageId: message.id,
    remoteThreadId: message.conversationId ?? message.id,
    internetMessageId: message.internetMessageId ?? undefined,
    from: normalizeAddress(message.from) ?? { address: "unknown@invalid" },
    replyTo: normalizeAddresses(message.replyTo),
    to: normalizeAddresses(message.toRecipients) ?? [],
    cc: normalizeAddresses(message.ccRecipients) ?? [],
    bcc: normalizeAddresses(message.bccRecipients) ?? [],
    subject: nonemptyString(message.subject, "(no subject)"),
    snippet: message.bodyPreview ?? "",
    plainText: message.body?.content?.length ? message.body.content : undefined,
    headers,
    remoteLabelIds: message.parentFolderId ? [message.parentFolderId] : [],
    sentAt: parseDate(message.sentDateTime),
    receivedAt,
    hasAttachments: message.hasAttachments ?? attachments.length > 0,
    inInbox: true,
    isRead: message.isRead ?? false,
    direction: "incoming",
    attachments,
  };
}

function normalizeAttachment(
  attachment: GraphAttachment,
): NormalizedAttachment[] {
  if (!attachment.id) return [];
  return [
    {
      remoteAttachmentId: attachment.id,
      fileName: nonemptyString(attachment.name, "attachment"),
      contentType: nonemptyString(
        attachment.contentType,
        "application/octet-stream",
      ),
      size: attachment.size ?? 0,
      isInline: attachment.isInline ?? false,
      contentId: attachment.contentId ?? undefined,
    },
  ];
}

function normalizeAddresses(values: GraphRecipient[] | undefined) {
  const addresses = (values ?? []).flatMap((value) => {
    const normalized = normalizeAddress(value);
    return normalized ? [normalized] : [];
  });
  return addresses.length > 0 ? addresses : undefined;
}

function normalizeAddress(value: GraphRecipient | undefined) {
  const address = value?.emailAddress?.address?.trim().toLowerCase();
  if (!address) return undefined;
  const name = value?.emailAddress?.name?.trim();
  return { address, name: name?.length ? name : undefined };
}

function toRecipients(addresses: OutboxPayload["to"]) {
  return addresses.map((entry) => ({
    emailAddress: {
      address: entry.address,
      name: entry.name,
    },
  }));
}

function initialDeltaUrl() {
  const url = new URL(`${GRAPH_ROOT}/me/mailFolders/inbox/messages/delta`);
  url.searchParams.set("$select", MESSAGE_SELECT);
  url.searchParams.set(
    "$expand",
    "attachments($select=id,name,contentType,size,isInline)",
  );
  url.searchParams.set(
    "$filter",
    `receivedDateTime ge ${new Date(
      Date.now() - INITIAL_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()}`,
  );
  url.searchParams.set("$orderby", "receivedDateTime desc");
  url.searchParams.set("$top", "200");
  return url.toString();
}

async function graphFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  headers.set("Prefer", GRAPH_PREFERENCES);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(validateGraphUrl(path), {
    ...init,
    headers,
  });
  const text = await response.text();
  if (!response.ok) {
    const body = parseGraphError(text);
    throw new MicrosoftGraphError(
      body?.error?.message ??
        `Microsoft Graph request failed with ${response.status}`,
      response.status,
      body?.error?.code,
    );
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function graphFetchBytes(accessToken: string, path: string) {
  const response = await fetch(validateGraphUrl(path), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/octet-stream",
      Prefer: GRAPH_PREFERENCES,
    },
  });
  if (!response.ok) {
    throw new MicrosoftGraphError(
      `Microsoft attachment request failed with ${response.status}`,
      response.status,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function parseGraphError(value: string) {
  try {
    return JSON.parse(value) as {
      error?: { code?: string; message?: string };
    };
  } catch {
    return undefined;
  }
}

function validateDeltaUrl(value: string) {
  const url = new URL(validateGraphUrl(value));
  if (!/\/messages\/delta\/?$/iu.test(url.pathname)) {
    throw new Error("Microsoft delta cursor targets an unexpected resource");
  }
  return url.toString();
}

function validateGraphUrl(value: string) {
  const url = value.startsWith("https://")
    ? new URL(value)
    : new URL(`${GRAPH_ROOT}${value.startsWith("/") ? value : `/${value}`}`);
  if (url.origin !== "https://graph.microsoft.com") {
    throw new Error("Microsoft Graph returned an unexpected URL");
  }
  if (!url.pathname.toLowerCase().startsWith("/v1.0/")) {
    throw new Error("Microsoft Graph URL must use the v1.0 API");
  }
  return url.toString();
}

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function nonemptyString(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized?.length ? normalized : fallback;
}

const WELL_KNOWN_FOLDERS = [
  ["inbox", "inbox"],
  ["sentitems", "sent"],
  ["drafts", "drafts"],
  ["archive", "archive"],
  ["deleteditems", "trash"],
  ["junkemail", "junk"],
] as const satisfies readonly (readonly [string, NormalizedFolder["kind"]])[];

interface GraphCollection<T> {
  value?: T[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

interface GraphFolder {
  id?: string;
  displayName?: string;
  childFolderCount?: number;
}

interface GraphMessage {
  id?: string;
  conversationId?: string;
  internetMessageId?: string | null;
  subject?: string;
  body?: { content?: string; contentType?: string };
  bodyPreview?: string;
  from?: GraphRecipient;
  replyTo?: GraphRecipient[];
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  bccRecipients?: GraphRecipient[];
  receivedDateTime?: string;
  sentDateTime?: string;
  isRead?: boolean;
  isDraft?: boolean;
  hasAttachments?: boolean;
  parentFolderId?: string;
  internetMessageHeaders?: { name?: string; value?: string }[];
  attachments?: GraphAttachment[];
  "@removed"?: { reason?: string };
}

interface GraphRecipient {
  emailAddress?: { address?: string; name?: string };
}

interface GraphAttachment {
  id?: string;
  name?: string;
  contentType?: string;
  size?: number;
  isInline?: boolean;
  contentId?: string | null;
}
