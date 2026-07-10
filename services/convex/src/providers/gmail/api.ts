/* eslint-disable complexity, max-lines, no-restricted-syntax, @typescript-eslint/consistent-type-assertions -- Gmail's paginated REST and MIME boundaries require explicit parsing contracts. */
import type {
  MailProviderAdapter,
  NormalizedAttachment,
  NormalizedFolder,
  NormalizedMessage,
  OutboxPayload,
} from "../types";

const API_ROOT = "https://gmail.googleapis.com/gmail/v1/users/me";
const INITIAL_MESSAGE_LIMIT = 200;

interface GmailHeader {
  name?: string;
  value?: string;
}
interface GmailBody {
  attachmentId?: string;
  data?: string;
  size?: number;
}
interface GmailPart {
  body?: GmailBody;
  filename?: string;
  headers?: GmailHeader[];
  mimeType?: string;
  partId?: string;
  parts?: GmailPart[];
}
interface GmailMessage {
  historyId?: string;
  id?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPart;
  snippet?: string;
  threadId?: string;
}
interface GmailHistoryMessage {
  message?: { id?: string };
}

export class GmailApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "GmailApiError";
  }
}

export class GmailAdapter implements MailProviderAdapter {
  async fullSync(accessToken: string) {
    const [{ historyId }, folders, messageIds] = await Promise.all([
      gmailFetch<{ historyId: string }>(accessToken, "/profile"),
      this.listFolders(accessToken),
      this.listRecentMessageIds(accessToken),
    ]);
    const messages = await mapConcurrent(messageIds, 12, async (messageId) =>
      this.getMessage(accessToken, messageId),
    );
    return { cursor: historyId, folders, messages };
  }

  async incrementalSync(accessToken: string, cursor: string) {
    const changed = new Set<string>();
    const deleted = new Set<string>();
    let pageToken: string | undefined;
    let nextCursor = cursor;

    do {
      const params = new URLSearchParams({
        startHistoryId: cursor,
        maxResults: "500",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await gmailFetch<{
        history?: {
          messagesAdded?: GmailHistoryMessage[];
          messagesDeleted?: GmailHistoryMessage[];
          labelsAdded?: GmailHistoryMessage[];
          labelsRemoved?: GmailHistoryMessage[];
        }[];
        historyId?: string;
        nextPageToken?: string;
      }>(accessToken, `/history?${params.toString()}`);

      for (const record of page.history ?? []) {
        for (const entry of [
          ...(record.messagesAdded ?? []),
          ...(record.labelsAdded ?? []),
          ...(record.labelsRemoved ?? []),
        ]) {
          const id = entry.message?.id;
          if (id) changed.add(id);
        }
        for (const entry of record.messagesDeleted ?? []) {
          const id = entry.message?.id;
          if (id) {
            deleted.add(id);
            changed.delete(id);
          }
        }
      }
      if (page.historyId) nextCursor = page.historyId;
      pageToken = page.nextPageToken;
    } while (pageToken);

    const messages = (
      await mapConcurrent([...changed], 12, async (messageId) => {
        try {
          return await this.getMessage(accessToken, messageId);
        } catch (error) {
          if (error instanceof GmailApiError && error.status === 404) {
            deleted.add(messageId);
            return undefined;
          }
          throw error;
        }
      })
    ).filter((message): message is NormalizedMessage => message !== undefined);

    return {
      cursor: nextCursor,
      deletedRemoteMessageIds: [...deleted],
      messages,
    };
  }

  async findDeletedMessageIds(accessToken: string, remoteMessageIds: string[]) {
    const results = await mapConcurrent(
      remoteMessageIds,
      12,
      async (messageId) => {
        try {
          await this.getMessage(accessToken, messageId);
          return undefined;
        } catch (error) {
          if (error instanceof GmailApiError && error.status === 404) {
            return messageId;
          }
          throw error;
        }
      },
    );
    return results.filter((messageId): messageId is string =>
      Boolean(messageId),
    );
  }

  async sendMessage(accessToken: string, payload: OutboxPayload) {
    const internetMessageId = `<rodge-${payload._id}@rodge-mail.local>`;
    const existing = await this.findByInternetMessageId(
      accessToken,
      internetMessageId,
    );
    if (existing) return { remoteMessageId: existing };

    const raw = createMimeMessage(payload, internetMessageId);
    const message = await gmailFetch<GmailMessage>(
      accessToken,
      "/messages/send",
      {
        method: "POST",
        body: JSON.stringify({ raw }),
      },
    );
    if (!message.id)
      throw new Error("Gmail send response omitted the message ID");
    return { remoteMessageId: message.id };
  }

  async fetchAttachment(
    accessToken: string,
    remoteMessageId: string,
    remoteAttachmentId: string,
  ) {
    const response = await gmailFetch<{ data?: string }>(
      accessToken,
      `/messages/${encodeURIComponent(remoteMessageId)}/attachments/${encodeURIComponent(remoteAttachmentId)}`,
    );
    if (!response.data) throw new Error("Gmail attachment response was empty");
    return decodeBase64Url(response.data);
  }

  async setRead(accessToken: string, remoteMessageId: string, isRead: boolean) {
    await gmailFetch(
      accessToken,
      `/messages/${encodeURIComponent(remoteMessageId)}/modify`,
      {
        method: "POST",
        body: JSON.stringify(
          isRead ? { removeLabelIds: ["UNREAD"] } : { addLabelIds: ["UNREAD"] },
        ),
      },
    );
  }

  private async listRecentMessageIds(accessToken: string) {
    const ids: string[] = [];
    let pageToken: string | undefined;
    while (ids.length < INITIAL_MESSAGE_LIMIT) {
      const params = new URLSearchParams({
        maxResults: String(Math.min(100, INITIAL_MESSAGE_LIMIT - ids.length)),
      });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await gmailFetch<{
        messages?: { id?: string }[];
        nextPageToken?: string;
      }>(accessToken, `/messages?${params.toString()}`);
      ids.push(
        ...(page.messages ?? [])
          .map((message) => message.id)
          .filter((id): id is string => id !== undefined),
      );
      pageToken = page.nextPageToken;
      if (!pageToken) break;
    }
    return ids;
  }

  private async listFolders(accessToken: string) {
    const response = await gmailFetch<{
      labels?: { id?: string; name?: string; type?: string }[];
    }>(accessToken, "/labels");
    return (response.labels ?? [])
      .filter((label): label is { id: string; name: string; type?: string } =>
        Boolean(label.id && label.name),
      )
      .map(
        (label): NormalizedFolder => ({
          remoteFolderId: label.id,
          name: label.name,
          kind: gmailLabelKind(label.id, label.type),
        }),
      );
  }

  private async getMessage(accessToken: string, messageId: string) {
    const params = new URLSearchParams({ format: "full" });
    const message = await gmailFetch<GmailMessage>(
      accessToken,
      `/messages/${encodeURIComponent(messageId)}?${params.toString()}`,
    );
    return normalizeMessage(message);
  }

  private async findByInternetMessageId(
    accessToken: string,
    internetMessageId: string,
  ) {
    const params = new URLSearchParams({
      maxResults: "1",
      q: `rfc822msgid:${internetMessageId}`,
    });
    const page = await gmailFetch<{ messages?: { id?: string }[] }>(
      accessToken,
      `/messages?${params.toString()}`,
    );
    return page.messages?.at(0)?.id;
  }
}

async function gmailFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as
      | { error?: { message?: string; status?: string } }
      | undefined;
    throw new GmailApiError(
      body?.error?.message ?? `Gmail request failed with ${response.status}`,
      response.status,
      body?.error?.status,
    );
  }
  return (await response.json()) as T;
}

function normalizeMessage(message: GmailMessage): NormalizedMessage {
  if (!message.id || !message.threadId) {
    throw new Error("Gmail message omitted its stable identifiers");
  }
  const headers = (message.payload?.headers ?? [])
    .filter((header): header is { name: string; value: string } =>
      Boolean(header.name && header.value !== undefined),
    )
    .map((header) => ({ name: header.name, value: header.value }));
  const from = parseAddresses(headerValue(headers, "From")).at(0) ?? {
    address: "unknown@invalid",
  };
  const to = parseAddresses(headerValue(headers, "To"));
  const cc = parseAddresses(headerValue(headers, "Cc"));
  const bcc = parseAddresses(headerValue(headers, "Bcc"));
  const replyTo = parseAddresses(headerValue(headers, "Reply-To"));
  const labels = message.labelIds ?? [];
  const attachments = collectAttachments(message.payload);
  const receivedAt = Number(message.internalDate ?? Date.now());
  const sentAt = parseDate(headerValue(headers, "Date"));

  return {
    remoteMessageId: message.id,
    remoteThreadId: message.threadId,
    internetMessageId: headerValue(headers, "Message-ID") || undefined,
    from,
    replyTo: replyTo.length > 0 ? replyTo : undefined,
    to,
    cc,
    bcc,
    subject: headerValue(headers, "Subject") || "(no subject)",
    snippet: message.snippet ?? "",
    plainText: findPlainText(message.payload),
    headers,
    remoteLabelIds: labels,
    sentAt,
    receivedAt: Number.isFinite(receivedAt) ? receivedAt : Date.now(),
    hasAttachments: attachments.length > 0,
    inInbox: labels.includes("INBOX"),
    isRead: !labels.includes("UNREAD"),
    direction: labels.includes("SENT") ? "outgoing" : "incoming",
    attachments,
  };
}

function findPlainText(part?: GmailPart): string | undefined {
  const plainText = findMimeText(part, "text/plain");
  if (plainText?.trim()) return plainText;

  const html = findMimeText(part, "text/html");
  return html ? gmailHtmlToPlainText(html) || undefined : undefined;
}

function findMimeText(
  part: GmailPart | undefined,
  mimeType: "text/html" | "text/plain",
): string | undefined {
  if (!part) return undefined;
  if (part.mimeType === mimeType && part.body?.data) {
    return decodeBase64UrlText(part.body.data);
  }
  for (const child of part.parts ?? []) {
    const text = findMimeText(child, mimeType);
    if (text) return text;
  }
  return undefined;
}

export function gmailHtmlToPlainText(html: string) {
  const withBreaks = html
    .replace(
      /<(?:head|script|style|title)\b[^>]*>[\s\S]*?<\/(?:head|script|style|title)>/giu,
      " ",
    )
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<li\b[^>]*>/giu, "• ")
    .replace(
      /<\/(?:article|blockquote|div|h[1-6]|li|ol|p|section|table|tr|ul)>/giu,
      "\n",
    )
    .replace(/<[^>]+>/gu, " ");

  return decodeHtmlEntities(withBreaks)
    .replace(/\r/gu, "")
    .replace(/[\t\f\v ]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    bull: "•",
    copy: "©",
    emsp: " ",
    ensp: " ",
    euro: "€",
    gt: ">",
    hellip: "…",
    laquo: "«",
    ldquo: "“",
    lsquo: "‘",
    lt: "<",
    mdash: "—",
    middot: "·",
    nbsp: " ",
    ndash: "–",
    pound: "£",
    quot: '"',
    raquo: "»",
    rdquo: "”",
    reg: "®",
    rsquo: "’",
    trade: "™",
    yen: "¥",
  };

  return value
    .replace(/&#(x[\da-f]+|\d+);/giu, (entity, encoded: string) => {
      const hexadecimal = encoded.toLowerCase().startsWith("x");
      const codePoint = Number.parseInt(
        hexadecimal ? encoded.slice(1) : encoded,
        hexadecimal ? 16 : 10,
      );
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    })
    .replace(/&([a-z]+);/giu, (entity, name: string) => {
      return namedEntities[name.toLowerCase()] ?? entity;
    });
}

function collectAttachments(part?: GmailPart): NormalizedAttachment[] {
  if (!part) return [];
  const attachments: NormalizedAttachment[] = [];
  if (part.filename && part.body?.attachmentId) {
    const contentId = headerValue(
      (part.headers ?? []).flatMap((header) =>
        header.name && header.value
          ? [{ name: header.name, value: header.value }]
          : [],
      ),
      "Content-ID",
    );
    attachments.push({
      remoteAttachmentId: part.body.attachmentId,
      fileName: part.filename,
      contentType: part.mimeType ?? "application/octet-stream",
      size: part.body.size ?? 0,
      isInline: Boolean(contentId),
      contentId: contentId || undefined,
    });
  }
  for (const child of part.parts ?? []) {
    attachments.push(...collectAttachments(child));
  }
  return attachments;
}

function parseAddresses(value: string) {
  return splitAddresses(value).flatMap((entry) => {
    const match = /^(?:\s*"?([^"<]*)"?\s*)?<([^>]+)>\s*$/u.exec(entry);
    const matchedAddress = match?.at(2);
    if (matchedAddress) {
      const name = (match?.at(1) ?? "").trim();
      return [
        {
          address: matchedAddress.trim().toLowerCase(),
          name: name || undefined,
        },
      ];
    }
    const address = entry.trim().replace(/^<|>$/gu, "").toLowerCase();
    return address.includes("@") ? [{ address }] : [];
  });
}

function splitAddresses(value: string) {
  const entries: string[] = [];
  let current = "";
  let quoted = false;
  for (const character of value) {
    if (character === '"') quoted = !quoted;
    if (character === "," && !quoted) {
      entries.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  if (current) entries.push(current);
  return entries;
}

function headerValue(headers: { name: string; value: string }[], name: string) {
  return (
    headers.find((header) => header.name.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}

function gmailLabelKind(id: string, type?: string): NormalizedFolder["kind"] {
  const systemKinds: Record<string, NormalizedFolder["kind"]> = {
    INBOX: "inbox",
    SENT: "sent",
    DRAFT: "drafts",
    TRASH: "trash",
    SPAM: "junk",
  };
  return systemKinds[id] ?? (type === "user" ? "custom" : "archive");
}

function parseDate(value: string) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function decodeBase64UrlText(value: string) {
  return new TextDecoder().decode(decodeBase64Url(value));
}

function decodeBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function createMimeMessage(payload: OutboxPayload, internetMessageId: string) {
  const headers = [
    ["From", payload.from],
    ["To", formatAddresses(payload.to)],
    ["Cc", formatAddresses(payload.cc)],
    ["Bcc", formatAddresses(payload.bcc)],
    ["Subject", sanitizeHeader(payload.subject)],
    ["Message-ID", internetMessageId],
    ["MIME-Version", "1.0"],
  ];
  if (payload.replyToInternetMessageId) {
    const replyId = sanitizeHeader(payload.replyToInternetMessageId);
    headers.push(["In-Reply-To", replyId], ["References", replyId]);
  }
  if (payload.attachments.length === 0) {
    headers.push(
      ["Content-Type", 'text/plain; charset="UTF-8"'],
      ["Content-Transfer-Encoding", "8bit"],
    );
  }
  const rawHeaders = headers
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\r\n");
  if (payload.attachments.length === 0) {
    return encodeBase64UrlText(
      `${rawHeaders}\r\n\r\n${normalizeCrlf(payload.plainText)}`,
    );
  }

  const boundary = `rodge-mail-${payload._id}`;
  const parts = [
    `--${boundary}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${normalizeCrlf(payload.plainText)}`,
    ...payload.attachments.map((attachment) =>
      createAttachmentPart(boundary, attachment),
    ),
    `--${boundary}--`,
  ];
  const raw = `${rawHeaders}\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n${parts.join("\r\n")}`;
  return encodeBase64UrlText(raw);
}

function createAttachmentPart(
  boundary: string,
  attachment: OutboxPayload["attachments"][number],
) {
  const fallbackName = attachment.fileName
    .replace(/[^\x20-\x7e]/gu, "_")
    .replaceAll('"', "'");
  const encodedName = encodeRfc5987Value(attachment.fileName);
  const encodedBytes = wrapBase64(encodeBase64(attachment.bytes));
  return `--${boundary}\r\nContent-Type: ${sanitizeHeader(attachment.contentType)}; name="${fallbackName}"\r\nContent-Disposition: attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}\r\nContent-Transfer-Encoding: base64\r\n\r\n${encodedBytes}`;
}

function encodeRfc5987Value(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/gu, (character) => {
    return `%${character.charCodeAt(0).toString(16).toUpperCase()}`;
  });
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/gu)?.join("\r\n") ?? "";
}

function formatAddresses(addresses: OutboxPayload["to"]) {
  return addresses
    .map((address) =>
      address.name
        ? `"${sanitizeHeader(address.name).replaceAll('"', "'")}" <${sanitizeHeader(address.address)}>`
        : sanitizeHeader(address.address),
    )
    .join(", ");
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/gu, " ").trim();
}

function normalizeCrlf(value: string) {
  return value.replace(/\r?\n/gu, "\r\n");
}

function encodeBase64UrlText(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const result = new Array<R>(values.length);
  const queue = values.map((value, index) => ({ index, value }));
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        result[item.index] = await mapper(item.value);
      }
    }),
  );
  return result;
}
