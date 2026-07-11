export const IMPORTANT_MESSAGE_THRESHOLD = 0.6;

export function isImportantMessage(importance: number | undefined) {
  return (
    importance !== undefined &&
    Number.isFinite(importance) &&
    importance >= IMPORTANT_MESSAGE_THRESHOLD
  );
}
