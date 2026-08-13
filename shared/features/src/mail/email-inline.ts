import type { EmailTextInline } from "./email-text";

const LINK_PATTERN =
  /(?:https?:\/\/|mailto:|www\.)[^\s<>"']+|[\w.!#$%&'*+/=?^`{|}~-]+@[\w](?:[\w-]{0,61}[\w])?(?:\.[\w](?:[\w-]{0,61}[\w])?)+/giu;
const MARKDOWN_INLINE_PATTERN =
  /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|`([^`\n]+)`|(?<!\*)\*([^*\n]+)\*(?!\*)|(?<![\w_])_([^_\n]+)_(?![\w_])/gu;

export function tokenizeEmailInline(value: string, markdown: boolean) {
  if (!markdown) return tokenizeLinks(value);
  const tokens = new Array<EmailTextInline>();
  let cursor = 0;

  for (const match of value.matchAll(MARKDOWN_INLINE_PATTERN)) {
    if (match.index > cursor) {
      appendLinkifiedText(tokens, value.slice(cursor, match.index));
    }
    appendMarkdownToken(tokens, match);
    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) {
    appendLinkifiedText(tokens, value.slice(cursor));
  }
  return tokens;
}

function tokenizeLinks(value: string) {
  const tokens = new Array<EmailTextInline>();
  appendLinkifiedText(tokens, value);
  return tokens;
}

function appendLinkifiedText(tokens: EmailTextInline[], value: string) {
  let cursor = 0;

  for (const match of value.matchAll(LINK_PATTERN)) {
    const candidate = trimLinkPunctuation(match[0]);
    const start = match.index;
    if (start > cursor) pushText(tokens, value.slice(cursor, start));

    const link = toSafeLink(candidate.href);
    if (link) {
      tokens.push(link);
    } else {
      pushText(tokens, candidate.href);
    }
    if (candidate.trailing) pushText(tokens, candidate.trailing);
    cursor = start + match[0].length;
  }

  if (cursor < value.length) pushText(tokens, value.slice(cursor));
}

function appendMarkdownToken(
  tokens: EmailTextInline[],
  match: RegExpExecArray,
) {
  const markdownLinkText = match[1];
  const markdownLinkHref = match[2];
  if (markdownLinkText && markdownLinkHref) {
    const link = toSafeLink(markdownLinkHref);
    if (link) {
      tokens.push({ ...link, display: markdownLinkText });
      return;
    }
  }
  const strong = match[3] ?? match[4];
  if (strong) {
    tokens.push({ type: "strong", value: strong });
    return;
  }
  if (match[5]) {
    tokens.push({ type: "code", value: match[5] });
    return;
  }
  const emphasis = match[6] ?? match[7];
  if (emphasis) {
    tokens.push({ type: "emphasis", value: emphasis });
    return;
  }
  appendLinkifiedText(tokens, match[0]);
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
  return { href, trailing };
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
