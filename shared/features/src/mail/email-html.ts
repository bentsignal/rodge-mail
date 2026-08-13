const IMAGE_SOURCE_PATTERN = /(<img\b[^>]*?\s+src\s*=\s*)(["'])([^"']*)\2/giu;

export function prepareEmailHtmlForDisplay(
  html: string,
  inlineImageUrls: Readonly<Record<string, string>> = {},
) {
  const normalizedInlineUrls = new Map(
    Object.entries(inlineImageUrls).map(([contentId, url]) => [
      normalizeContentId(contentId),
      url,
    ]),
  );
  return html.replace(
    IMAGE_SOURCE_PATTERN,
    (source, prefix: string, quote: string, url: string) => {
      const resolvedUrl = resolveImageUrl(url, normalizedInlineUrls);
      return `${prefix}${quote}${resolvedUrl}${quote}`;
    },
  );
}

function resolveImageUrl(url: string, inlineImageUrls: Map<string, string>) {
  if (url.toLowerCase().startsWith("http://")) {
    return `https://${url.slice("http://".length)}`;
  }
  if (!url.toLowerCase().startsWith("cid:")) return url;
  const contentId = normalizeContentId(safeDecode(url.slice("cid:".length)));
  return inlineImageUrls.get(contentId) ?? url;
}

function normalizeContentId(value: string) {
  return value.trim().replace(/^<|>$/gu, "").toLowerCase();
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
