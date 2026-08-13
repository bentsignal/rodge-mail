import { tokenizeEmailInline } from "./email-inline";

export type EmailTextInline =
  | { type: "code"; value: string }
  | { type: "emphasis"; value: string }
  | { type: "text"; value: string }
  | { display: string; href: string; type: "link" }
  | { type: "strong"; value: string };

export type EmailTextBlock =
  | { content: EmailTextInline[]; level: number; type: "heading" }
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

const BULLET_PATTERN = /^\s*[-*•]\s+(.+)$/u;
const NUMBERED_PATTERN = /^\s*(\d+)[.)]\s+(.+)$/u;
const QUOTE_PATTERN = /^\s*>\s?(.*)$/u;
const HEADING_PATTERN = /^\s{0,3}(#{1,3})\s+(.+)$/u;

export function parseEmailText(
  source: string | readonly string[] | undefined,
  options: { markdown?: boolean } = {},
) {
  const normalized = normalizeSource(source);
  if (!normalized.trim()) return [];
  const markdown = options.markdown === true;

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
      const result = readQuote(lines, index, markdown);
      blocks.push(result.block);
      index = result.nextIndex;
      continue;
    }

    const heading = getHeading(line, markdown);
    if (heading) {
      blocks.push({
        content: tokenizeEmailInline(heading.value, markdown),
        level: heading.level,
        type: "heading",
      });
      index += 1;
      continue;
    }

    const listItem = getListItem(line);
    if (listItem) {
      const result = readList(lines, index, listItem, markdown);
      blocks.push(result.block);
      index = result.nextIndex;
      continue;
    }

    const result = readParagraph(lines, index, markdown);
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

function readParagraph(lines: string[], startIndex: number, markdown: boolean) {
  const paragraphLines = new Array<string>();
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (
      !line.trim() ||
      QUOTE_PATTERN.test(line) ||
      getHeading(line, markdown) ||
      getListItem(line)
    ) {
      break;
    }
    paragraphLines.push(line.trimEnd());
    index += 1;
  }

  return {
    block: {
      content: tokenizeEmailInline(paragraphLines.join("\n").trim(), markdown),
      type: "paragraph",
    } satisfies EmailTextBlock,
    nextIndex: index,
  };
}

function readQuote(lines: string[], startIndex: number, markdown: boolean) {
  const quoteLines = new Array<string>();
  let index = startIndex;

  while (index < lines.length) {
    const match = QUOTE_PATTERN.exec(lines[index] ?? "");
    if (!match) break;
    quoteLines.push(match[1] ?? "");
    index += 1;
  }

  const paragraphs = splitParagraphs(quoteLines).map((paragraph) =>
    tokenizeEmailInline(paragraph, markdown),
  );
  return {
    block: { paragraphs, type: "quote" } satisfies EmailTextBlock,
    nextIndex: index,
  };
}

function readList(
  lines: string[],
  startIndex: number,
  firstItem: ListItem,
  markdown: boolean,
) {
  const items = new Array<EmailTextInline[]>();
  let index = startIndex;

  while (index < lines.length) {
    const item = getListItem(lines[index] ?? "");
    if (!item || item.ordered !== firstItem.ordered) break;
    items.push(tokenizeEmailInline(item.value, markdown));
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

function getHeading(line: string, markdown: boolean) {
  if (!markdown) return undefined;
  const match = HEADING_PATTERN.exec(line);
  if (!match?.[1] || !match[2]) return undefined;
  return { level: match[1].length, value: match[2] };
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
