import sanitizeHtml from "sanitize-html";

const BLOCKED_TAGS = [
  "applet",
  "audio",
  "base",
  "embed",
  "form",
  "frame",
  "frameset",
  "iframe",
  "input",
  "link",
  "meta",
  "object",
  "script",
  "select",
  "source",
  "style",
  "textarea",
  "video",
];

export function sanitizeEmailHtml(html: string | undefined) {
  const source = html?.trim();
  if (!source) return undefined;
  return sanitizeHtml(source, {
    allowedAttributes: {
      "*": [
        "align",
        "aria-label",
        "class",
        "dir",
        "height",
        "lang",
        "role",
        "style",
        "title",
        "width",
      ],
      a: ["href", "name", "rel", "target"],
      img: ["alt", "border", "height", "src", "title", "width"],
      table: ["border", "cellpadding", "cellspacing", "height", "width"],
      td: ["colspan", "height", "rowspan", "valign", "width"],
      th: ["colspan", "height", "rowspan", "scope", "valign", "width"],
    },
    allowedSchemes: ["data", "http", "https", "mailto"],
    allowedSchemesByTag: { img: ["cid", "data", "http", "https"] },
    allowedTags: sanitizeHtml.defaults.allowedTags
      .filter((tag) => !BLOCKED_TAGS.includes(tag))
      .concat(["center", "font", "img"]),
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noreferrer noopener",
        target: "_blank",
      }),
    },
  });
}

export function emailHtmlToPlainText(html: string) {
  return sanitizeEmailHtml(html)
    ?.replace(/<br\s*\/?>/giu, "\n")
    .replace(/<li\b[^>]*>/giu, "• ")
    .replace(
      /<\/(?:article|blockquote|div|h[1-6]|li|ol|p|section|table|tr|ul)>/giu,
      "\n",
    )
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#(?:39|x27);/giu, "'")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n[ \t]+/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}
