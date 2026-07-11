interface MailSearchConstraints {
  after?: number;
  before?: number;
  sender?: string;
  subject?: string;
}

interface MailSearchPlan extends MailSearchConstraints {
  lexicalQuery: string;
}

class MutableMailSearchPlan implements MailSearchPlan {
  after?: number;
  before?: number;
  lexicalQuery = "";
  sender?: string;
  subject?: string;
}

interface SearchableMessage {
  from: { address: string; name?: string };
  receivedAt: number;
  subject: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseMailSearch(input: string, now = Date.now()) {
  let remaining = input.normalize("NFKC").trim();
  const plan = new MutableMailSearchPlan();

  remaining = extractExplicitDate(remaining, "after", plan);
  remaining = extractExplicitDate(remaining, "before", plan);
  remaining = extractOnDate(remaining, plan);
  remaining = extractRelativeDate(remaining, now, plan);
  remaining = extractField(remaining, "from", (value) => {
    plan.sender = value;
  });
  remaining = extractField(remaining, "subject", (value) => {
    plan.subject = value;
  });
  remaining = extractNaturalSender(remaining, plan);
  remaining = extractNaturalSubject(remaining, plan);

  const semanticTerms = remaining
    .replace(/\b(?:emails?|messages?|mail)\b/giu, " ")
    .replace(/\b(?:about|containing|that mention(?:s|ed)?)\b/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  plan.lexicalQuery = uniqueTerms([plan.sender, plan.subject, semanticTerms]);
  return plan;
}

export function matchesMailSearch(
  message: SearchableMessage,
  plan: MailSearchConstraints,
) {
  if (plan.after !== undefined && message.receivedAt < plan.after) return false;
  if (plan.before !== undefined && message.receivedAt >= plan.before)
    return false;
  if (
    plan.sender &&
    !includesNormalized(formatSender(message.from), plan.sender)
  )
    return false;
  if (plan.subject && !includesNormalized(message.subject, plan.subject))
    return false;
  return true;
}

export function createMessageSearchText(input: {
  accountAddress: string;
  body?: string;
  cc: { address: string; name?: string }[];
  from: { address: string; name?: string };
  snippet: string;
  subject: string;
  to: { address: string; name?: string }[];
}) {
  return normalizeSearchText(
    [
      input.from.name,
      input.from.address,
      ...input.to.flatMap((address) => [address.name, address.address]),
      ...input.cc.flatMap((address) => [address.name, address.address]),
      input.accountAddress,
      input.subject,
      input.snippet,
      input.body?.slice(0, 20_000),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function extractExplicitDate(
  input: string,
  field: "after" | "before",
  plan: MailSearchPlan,
) {
  const expression = new RegExp(`\\b${field}:(\\d{4}-\\d{2}-\\d{2})\\b`, "iu");
  const match = expression.exec(input);
  if (!match?.[1]) return input;
  const date = parseIsoDay(match[1]);
  if (date !== undefined) plan[field] = date;
  return input.replace(match[0], " ");
}

function extractOnDate(input: string, plan: MailSearchPlan) {
  const match = /\bon:(\d{4}-\d{2}-\d{2})\b/iu.exec(input);
  if (!match?.[1]) return input;
  const date = parseIsoDay(match[1]);
  if (date !== undefined) {
    plan.after = date;
    plan.before = date + DAY_MS;
  }
  return input.replace(match[0], " ");
}

function extractRelativeDate(input: string, now: number, plan: MailSearchPlan) {
  const startToday = startOfUtcDay(now);
  const lastDays = /\blast\s+(\d{1,3})\s+days?\b/iu.exec(input);
  if (lastDays?.[1]) {
    plan.after = now - Number(lastDays[1]) * DAY_MS;
    plan.before = now + 1;
    return input.replace(lastDays[0], " ");
  }
  const yesterday = /\byesterday\b/iu.exec(input);
  if (yesterday) {
    plan.after = startToday - DAY_MS;
    plan.before = startToday;
    return input.replace(yesterday[0], " ");
  }
  const today = /\btoday\b/iu.exec(input);
  if (today) {
    plan.after = startToday;
    plan.before = startToday + DAY_MS;
    return input.replace(today[0], " ");
  }
  const startWeek = startOfUtcWeek(now);
  const lastWeek = /\blast\s+week\b/iu.exec(input);
  if (lastWeek) {
    plan.after = startWeek - 7 * DAY_MS;
    plan.before = startWeek;
    return input.replace(lastWeek[0], " ");
  }
  const thisWeek = /\bthis\s+week\b/iu.exec(input);
  if (thisWeek) {
    plan.after = startWeek;
    plan.before = now + 1;
    return input.replace(thisWeek[0], " ");
  }
  return input;
}

function extractField(
  input: string,
  field: "from" | "subject",
  apply: (value: string) => void,
) {
  const expression = new RegExp(`\\b${field}:(?:"([^"]+)"|(\\S+))`, "iu");
  const match = expression.exec(input);
  const value = match?.[1] ?? match?.[2];
  if (!match || !value) return input;
  apply(value.trim());
  return input.replace(match[0], " ");
}

function extractNaturalSender(input: string, plan: MailSearchPlan) {
  if (plan.sender) return input;
  const match = /\bfrom\s+(.+?)(?=\s+(?:about|containing|subject\b)|$)/iu.exec(
    input,
  );
  if (!match?.[1]) return input;
  plan.sender = stripQuotes(match[1]);
  return input.replace(match[0], " ");
}

function extractNaturalSubject(input: string, plan: MailSearchPlan) {
  if (plan.subject) return input;
  const match =
    /\b(?:with\s+)?subject\s+(.+?)(?=\s+(?:from|about|containing)|$)/iu.exec(
      input,
    );
  if (!match?.[1]) return input;
  plan.subject = stripQuotes(match[1]);
  return input.replace(match[0], " ");
}

function stripQuotes(value: string) {
  return value.trim().replace(/^"|"$/gu, "");
}

function parseIsoDay(value: string) {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function startOfUtcDay(timestamp: number) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function startOfUtcWeek(timestamp: number) {
  const day = startOfUtcDay(timestamp);
  const weekday = new Date(day).getUTCDay();
  return day - ((weekday + 6) % 7) * DAY_MS;
}

function uniqueTerms(values: (string | undefined)[]) {
  const seen = new Set<string>();
  const terms = [];
  for (const value of values) {
    const normalized = value?.replace(/\s+/gu, " ").trim();
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    terms.push(normalized);
  }
  return terms.join(" ").slice(0, 500);
}

function formatSender(sender: SearchableMessage["from"]) {
  return `${sender.name ?? ""} ${sender.address}`;
}

function includesNormalized(value: string, search: string) {
  return normalizeSearchText(value).includes(normalizeSearchText(search));
}

function normalizeSearchText(value: string) {
  return removeControlCharacters(value)
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function removeControlCharacters(value: string) {
  return Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32
        ? character
        : " ";
    })
    .join("");
}
