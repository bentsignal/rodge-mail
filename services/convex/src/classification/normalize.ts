interface Address {
  address: string;
  name?: string;
}
interface Header {
  name: string;
  value: string;
}

export interface ClassificationMessageInput {
  direction: "incoming" | "outgoing";
  from: Address;
  to: Address[];
  cc: Address[];
  subject: string;
  snippet: string;
  headers?: Header[];
  hasAttachments: boolean;
  isPinned: boolean;
}

export interface ClassificationContentInput {
  plainText?: string;
  truncated: boolean;
}

export interface NormalizedMail {
  direction: "incoming" | "outgoing";
  from: Address;
  to: Address[];
  cc: Address[];
  subject: string;
  snippet: string;
  body: string;
  headers: Header[];
  hasAttachments: boolean;
  isPinned: boolean;
  bodyWasTruncated: boolean;
}

const ALLOWED_HEADERS = new Set([
  "auto-submitted",
  "list-id",
  "list-unsubscribe",
  "precedence",
  "x-auto-response-suppress",
]);

export function normalizeMail(
  message: ClassificationMessageInput,
  content: ClassificationContentInput | null,
) {
  return {
    direction: message.direction,
    from: normalizeAddress(message.from),
    to: message.to.slice(0, 20).map(normalizeAddress),
    cc: message.cc.slice(0, 20).map(normalizeAddress),
    subject: normalizeText(message.subject, 500),
    snippet: normalizeText(message.snippet, 1_200),
    body: normalizeText(content?.plainText, 12_000),
    headers: normalizeHeaders(message.headers),
    hasAttachments: message.hasAttachments,
    isPinned: message.isPinned,
    bodyWasTruncated: content?.truncated ?? true,
  };
}

export function embeddingText(input: NormalizedMail) {
  return normalizeText(
    [
      `From: ${formatAddress(input.from)}`,
      `Subject: ${input.subject}`,
      input.snippet,
      input.body,
    ].join("\n"),
    14_000,
  );
}

export function stableHash(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let hash = 2_166_136_261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeAddress(address: Address) {
  return {
    address: normalizeText(address.address, 320).toLowerCase(),
    name: address.name ? normalizeText(address.name, 200) : undefined,
  };
}

function normalizeHeaders(headers: Header[] | undefined) {
  if (!headers) return [];
  return headers
    .filter((header) => ALLOWED_HEADERS.has(header.name.toLowerCase()))
    .slice(0, 12)
    .map((header) => ({
      name: normalizeText(header.name, 80).toLowerCase(),
      value: normalizeText(header.value, 500),
    }));
}

function normalizeText(value: string | undefined, limit: number) {
  if (!value) return "";
  const bounded = value.slice(0, Math.max(limit * 4, limit));
  return removeControlCharacters(bounded)
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, limit);
}

function removeControlCharacters(value: string) {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join("");
}

function formatAddress(address: Address) {
  return address.name
    ? `${address.name} <${address.address}>`
    : address.address;
}
