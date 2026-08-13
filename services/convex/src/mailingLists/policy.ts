interface MailingListMessage {
  direction: "incoming" | "outgoing";
  from: { address: string; name?: string };
  headers?: { name: string; value: string }[];
}

export interface MailingListInfo {
  displayName: string;
  listId?: string;
  mailto?: {
    address: string;
    body: string;
    subject: string;
  };
  oneClickUrl?: string;
  remoteMethod: "one_click" | "email" | "none";
  senderAddress: string;
}

export function getMailingListInfo(
  message: MailingListMessage,
  category?: string,
) {
  const senderAddress = getIncomingSender(message);
  if (!senderAddress) return undefined;
  const headers = normalizeHeaders(message.headers);
  const list = parseListId(headerValue(headers, "list-id"));
  const targets = parseUnsubscribeTargets(
    headerValue(headers, "list-unsubscribe"),
  );
  if (!isAdvertisingMail(headers, category)) return undefined;

  const oneClickUrl = getOneClickUrl(headers, targets.https);
  const remoteMethod = getRemoteMethod(oneClickUrl, targets.mailto);
  return {
    displayName: getDisplayName(message, list, senderAddress),
    listId: list?.id,
    mailto: targets.mailto,
    oneClickUrl,
    remoteMethod,
    senderAddress,
  };
}

export function messageMatchesSuppression(
  message: MailingListMessage,
  category: string | undefined,
  suppression: { listId?: string; senderAddress: string },
) {
  const info = getMailingListInfo(message, category);
  if (!info) return false;
  if (suppression.listId && info.listId === suppression.listId) return true;
  return info.senderAddress === suppression.senderAddress;
}

export function isSafeOneClickUrl(value: string) {
  try {
    const url = new URL(value);
    if (!isAllowedHttpsUrl(url)) return false;
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
    return !isForbiddenHostname(hostname);
  } catch {
    return false;
  }
}

function getIncomingSender(message: MailingListMessage) {
  if (message.direction !== "incoming") return undefined;
  return normalizeEmailAddress(message.from.address);
}

function getOneClickUrl(
  headers: { name: string; value: string }[],
  https: string | undefined,
) {
  const supportsOneClick =
    /(?:^|[;,\s])list-unsubscribe\s*=\s*one-click(?:$|[;,\s])/iu.test(
      headerValue(headers, "list-unsubscribe-post"),
    );
  return supportsOneClick ? https : undefined;
}

function getRemoteMethod(
  oneClickUrl: string | undefined,
  mailto: MailingListInfo["mailto"],
) {
  if (oneClickUrl) return "one_click" as const;
  if (mailto) return "email" as const;
  return "none" as const;
}

function getDisplayName(
  message: MailingListMessage,
  list: { id: string; name?: string } | undefined,
  senderAddress: string,
) {
  return (
    nonempty(list?.name) ??
    nonempty(message.from.name) ??
    list?.id ??
    senderAddress
  );
}

function nonempty(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return normalized;
}

function isAllowedHttpsUrl(url: URL) {
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  return !url.port || url.port === "443";
}

function isForbiddenHostname(hostname: string) {
  if (!hostname) return true;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (hostname.endsWith(".local")) return true;
  return isPrivateIpv4(hostname) || isPrivateIpv6(hostname);
}

function normalizeHeaders(headers: MailingListMessage["headers"]) {
  return (headers ?? []).slice(0, 500).map((header) => ({
    name: header.name.trim().toLowerCase(),
    value: header.value.trim().slice(0, 4_000),
  }));
}

function headerValue(headers: { name: string; value: string }[], name: string) {
  return headers.find((header) => header.name === name)?.value ?? "";
}

function parseListId(value: string) {
  if (!value) return undefined;
  const bracketed = /^(.*?)<([^<>]+)>/u.exec(value);
  const rawId = (bracketed?.[2] ?? value).trim().toLowerCase();
  if (!rawId || rawId.length > 320 || /[\s@]/u.test(rawId)) return undefined;
  const name = bracketed?.[1]?.replace(/^"|"$/gu, "").trim();
  return { id: rawId, name: name?.slice(0, 160) };
}

function parseUnsubscribeTargets(value: string) {
  const targets = [...value.matchAll(/<([^<>]+)>/gu)].map(
    (match) => match.at(1) ?? "",
  );
  let https: string | undefined;
  let mailto: MailingListInfo["mailto"];
  for (const target of targets.slice(0, 10)) {
    try {
      const url = new URL(target.trim());
      if (!https && isSafeOneClickUrl(url.toString())) {
        https = url.toString();
      }
      if (!mailto && url.protocol === "mailto:") {
        const address = normalizeEmailAddress(decodeURIComponent(url.pathname));
        if (!address) continue;
        mailto = {
          address,
          body: boundedQueryValue(
            url.searchParams.get("body"),
            "Please unsubscribe me from this mailing list.",
            4_000,
          ),
          subject: boundedQueryValue(
            url.searchParams.get("subject"),
            "Unsubscribe",
            300,
          ),
        };
      }
    } catch {
      continue;
    }
  }
  return { https, mailto };
}

function isAdvertisingMail(
  headers: { name: string; value: string }[],
  category?: string,
) {
  if (category === "newsletter") return true;
  if (headerValue(headers, "list-id")) return true;
  if (headerValue(headers, "list-unsubscribe")) return true;
  return /\b(?:bulk|list|junk)\b/iu.test(headerValue(headers, "precedence"));
}

function normalizeEmailAddress(value: string) {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length > 320 ||
    !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/u.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function boundedQueryValue(
  value: string | null,
  fallback: string,
  limit: number,
) {
  const normalized = value?.replace(/[\0\r]/gu, "").trim();
  return normalized ? normalized.slice(0, limit) : fallback;
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (!isIpv4Address(parts)) return false;
  return isPrivateIpv4Parts(parts[0] ?? -1, parts[1] ?? -1);
}

function isIpv4Address(parts: number[]) {
  if (parts.length !== 4) return false;
  return parts.every(isIpv4Octet);
}

function isIpv4Octet(part: number) {
  return Number.isInteger(part) && part >= 0 && part <= 255;
}

function isPrivateIpv4Parts(first: number, second: number) {
  if ([0, 10, 127].includes(first)) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  return first >= 224;
}

function isPrivateIpv6(hostname: string) {
  if (!hostname.includes(":")) return false;
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^(?:fe[89ab])/u.test(normalized)
  );
}
