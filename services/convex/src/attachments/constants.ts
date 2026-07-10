export const MAX_ATTACHMENT_COUNT = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 18 * 1024 * 1024;
export const MAX_ATTACHMENT_FILE_NAME_LENGTH = 120;

const allowedContentTypes = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/markdown",
  "text/plain",
]);

export function normalizeAttachmentContentType(contentType: string) {
  return contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function normalizeAttachmentFileName(fileName: string) {
  return fileName
    .normalize("NFKC")
    .split("")
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return character === "/" ||
        character === "\\" ||
        codePoint < 32 ||
        codePoint === 127
        ? "_"
        : character;
    })
    .join("")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_ATTACHMENT_FILE_NAME_LENGTH);
}

export function validateAttachmentMetadata({
  contentType,
  fileName,
  size,
}: {
  contentType: string;
  fileName: string;
  size: number;
}) {
  const normalizedName = normalizeAttachmentFileName(fileName);
  const normalizedType = normalizeAttachmentContentType(contentType);
  if (!normalizedName || normalizedName === "." || normalizedName === "..") {
    return "Attachment file name is invalid.";
  }
  if (!Number.isSafeInteger(size) || size <= 0) {
    return "Attachment is empty or its size is unavailable.";
  }
  if (size > MAX_ATTACHMENT_BYTES) {
    return "Each attachment must be 10 MB or smaller.";
  }
  if (!allowedContentTypes.has(normalizedType)) {
    return `Files of type ${normalizedType || "unknown"} are not supported.`;
  }
  return undefined;
}
