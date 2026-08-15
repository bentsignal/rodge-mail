export type NotificationQuickAction = "archive" | "mark-read" | "pin";

export function parseQuickActionRequest(value: unknown) {
  if (!isRecord(value)) return undefined;
  const { action, deliveryId, token } = value;
  if (
    !isQuickAction(action) ||
    typeof deliveryId !== "string" ||
    typeof token !== "string" ||
    deliveryId.length === 0 ||
    token.length < 32
  ) {
    return undefined;
  }
  return { action, deliveryId, token };
}

function isQuickAction(value: unknown): value is NotificationQuickAction {
  return value === "pin" || value === "mark-read" || value === "archive";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
