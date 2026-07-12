export type EmailTextInline =
  | { type: "text"; value: string }
  | { display: string; href: string; type: "link" };

export type EmailTextBlock =
  | { content: EmailTextInline[]; type: "paragraph" }
  | { paragraphs: EmailTextInline[][]; type: "quote" }
  | {
      items: EmailTextInline[][];
      ordered: boolean;
      start?: number;
      type: "list";
    };

const VISIBLE_ENTITIES = new Map([
  ["amp", "&"],
  ["apos", "'"],
  ["bull", "•"],
  ["copy", "©"],
  ["gt", ">"],
  ["hellip", "…"],
  ["laquo", "«"],
  ["ldquo", "“"],
  ["lt", "<"],
  ["lsquo", "‘"],
  ["mdash", "—"],
  ["nbsp", " "],
  ["ndash", "–"],
  ["quot", '"'],
  ["raquo", "»"],
  ["rdquo", "”"],
  ["reg", "®"],
  ["rsquo", "’"],
  ["trade", "™"],
]);

const LINK_PATTERN =
  /(?:https?:\/\/|mailto:|www\.)[^\s<>"']+|[\w.!#$%&'*+/=?^`{|}~-]+@[\w](?:[\w-]{0,61}[\w])?(?:\.[\w](?:[\w-]{0,61}[\w])?)+/giu;
const BULLET_PATTERN = /^\s*[-*•]\s+(.+)$/u;
const NUMBERED_PATTERN = /^\s*(\d+)[.)]\s+(.+)$/u;
const QUOTE_PATTERN = /^\s*>\s?(.*)$/u;

export function parseEmailText(source: string | readonly string[] | undefined) {
  const normalized = normalizeSource(source);
  if (!normalized.trim()) return [];

  const blocks = new Array<EmailTextBlock>();
  const lines = normalized.split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (QUOTE_PATTERN.test(line)) {
      const result = readQuote(lines, index);
      blocks.push(result.block);
      index = result.nextIndex;
      continue;
    }

    const listItem = getListItem(line);
    if (listItem) {
      const result = readList(lines, index, listItem);
      blocks.push(result.block);
      index = result.nextIndex;
      continue;
    }

    const result = readParagraph(lines, index);
    blocks.push(result.block);
    index = result.nextIndex;
  }

  return blocks;
}

function normalizeSource(source: string | readonly string[] | undefined) {
  const value =
    typeof source === "string" ? source : (source?.join("\n\n") ?? "");
  return decodeVisibleEntities(
    value.replaceAll("\r\n", "\n").replaceAll("\r", "\n"),
  );
}

function readParagraph(lines: string[], startIndex: number) {
  const paragraphLines = new Array<string>();
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim() || QUOTE_PATTERN.test(line) || getListItem(line)) break;
    paragraphLines.push(line.trimEnd());
    index += 1;
  }

  return {
    block: {
      content: tokenizeInline(paragraphLines.join("\n").trim()),
      type: "paragraph",
    } satisfies EmailTextBlock,
    nextIndex: index,
  };
}

function readQuote(lines: string[], startIndex: number) {
  const quoteLines = new Array<string>();
  let index = startIndex;

  while (index < lines.length) {
    const match = QUOTE_PATTERN.exec(lines[index] ?? "");
    if (!match) break;
    quoteLines.push(match[1] ?? "");
    index += 1;
  }

  const paragraphs = splitParagraphs(quoteLines).map(tokenizeInline);
  return {
    block: { paragraphs, type: "quote" } satisfies EmailTextBlock,
    nextIndex: index,
  };
}

function readList(lines: string[], startIndex: number, firstItem: ListItem) {
  const items = new Array<EmailTextInline[]>();
  let index = startIndex;

  while (index < lines.length) {
    const item = getListItem(lines[index] ?? "");
    if (!item || item.ordered !== firstItem.ordered) break;
    items.push(tokenizeInline(item.value));
    index += 1;
  }

  return {
    block: {
      items,
      ordered: firstItem.ordered,
      start: firstItem.number,
      type: "list",
    } satisfies EmailTextBlock,
    nextIndex: index,
  };
}

interface ListItem {
  number?: number;
  ordered: boolean;
  value: string;
}

function getListItem(line: string) {
  const bullet = BULLET_PATTERN.exec(line);
  if (bullet?.[1]) {
    return { ordered: false, value: bullet[1] } satisfies ListItem;
  }

  const numbered = NUMBERED_PATTERN.exec(line);
  if (!numbered?.[1] || !numbered[2]) return undefined;
  return {
    number: Number.parseInt(numbered[1], 10),
    ordered: true,
    value: numbered[2],
  } satisfies ListItem;
}

function splitParagraphs(lines: string[]) {
  const paragraphs = new Array<string>();
  let paragraph = new Array<string>();

  for (const line of lines) {
    if (line.trim()) {
      paragraph.push(line.trimEnd());
      continue;
    }
    if (paragraph.length > 0) paragraphs.push(paragraph.join("\n").trim());
    paragraph = [];
  }

  if (paragraph.length > 0) paragraphs.push(paragraph.join("\n").trim());
  return paragraphs;
}

function tokenizeInline(value: string) {
  const tokens = new Array<EmailTextInline>();
  let cursor = 0;

  for (const match of value.matchAll(LINK_PATTERN)) {
    const candidate = trimLinkPunctuation(match[0]);
    const start = match.index;
    if (start > cursor) {
      pushText(tokens, value.slice(cursor, start));
    }

    const link = toSafeLink(candidate.href);
    if (link) {
      tokens.push(link);
    } else {
      pushText(tokens, candidate.href);
    }
    if (candidate.trailing) {
      pushText(tokens, candidate.trailing);
    }
    cursor = start + match[0].length;
  }

  if (cursor < value.length) {
    pushText(tokens, value.slice(cursor));
  }
  return tokens;
}

function pushText(tokens: EmailTextInline[], value: string) {
  if (!value) return;
  const previous = tokens.at(-1);
  if (previous?.type === "text") {
    previous.value += value;
    return;
  }
  tokens.push({ type: "text", value });
}

function trimLinkPunctuation(value: string) {
  let href = value;
  let trailing = "";

  while (/[.,;:!?]$/u.test(href)) {
    trailing = `${href.at(-1)}${trailing}`;
    href = href.slice(0, -1);
  }

  while (hasUnmatchedClosingDelimiter(href)) {
    trailing = `${href.at(-1)}${trailing}`;
    href = href.slice(0, -1);
  }

  return {
    href,
    trailing,
  };
}

function toSafeLink(href: string) {
  if (/%(?:0a|0d)/iu.test(href)) return undefined;
  if (isPlainEmailAddress(href)) {
    return {
      display: href,
      href: `mailto:${href}`,
      type: "link",
    } satisfies EmailTextInline;
  }
  try {
    const normalizedHref = href.toLowerCase().startsWith("www.")
      ? `https://${href}`
      : href;
    const url = new URL(normalizedHref);
    if (url.protocol === "http:" || url.protocol === "https:") {
      if (!url.hostname) return undefined;
      return {
        display: url.hostname.replace(/^www\./iu, ""),
        href: normalizedHref,
        type: "link",
      } satisfies EmailTextInline;
    }
    if (url.protocol !== "mailto:" || !url.pathname.includes("@")) {
      return undefined;
    }
    return {
      display: decodeMailtoAddress(url.pathname),
      href,
      type: "link",
    } satisfies EmailTextInline;
  } catch {
    return undefined;
  }
}

function hasUnmatchedClosingDelimiter(value: string) {
  const delimiter = value.at(-1);
  if (delimiter !== ")" && delimiter !== "]" && delimiter !== "}") {
    return false;
  }
  const opening = delimiter === ")" ? "(" : delimiter === "]" ? "[" : "{";
  return countCharacter(value, delimiter) > countCharacter(value, opening);
}

function countCharacter(value: string, character: string) {
  let count = 0;
  for (const candidate of value) {
    if (candidate === character) count += 1;
  }
  return count;
}

function isPlainEmailAddress(value: string) {
  return /^[\w.!#$%&'*+/=?^`{|}~-]+@[\w](?:[\w-]{0,61}[\w])?(?:\.[\w](?:[\w-]{0,61}[\w])?)+$/iu.test(
    value,
  );
}

function decodeMailtoAddress(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeVisibleEntities(value: string) {
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/giu,
    (entity, decimal: string, hexadecimal: string, named: string) => {
      if (named) {
        return decodeNamedEntity(named) ?? entity;
      }
      const codePoint = Number.parseInt(
        decimal || hexadecimal,
        decimal ? 10 : 16,
      );
      if (!isVisibleCodePoint(codePoint)) return entity;
      return String.fromCodePoint(codePoint);
    },
  );
}

function decodeNamedEntity(name: string) {
  return VISIBLE_ENTITIES.get(name.toLowerCase());
}

function isVisibleCodePoint(codePoint: number) {
  return (
    Number.isFinite(codePoint) &&
    codePoint >= 0x20 &&
    codePoint <= 0x10ffff &&
    !(codePoint >= 0xd800 && codePoint <= 0xdfff)
  );
}
