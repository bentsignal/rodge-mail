export type NotificationFailureKind = "permanent" | "transient";

export type ParsedPushTicket =
  | { status: "accepted"; ticketId: string }
  | {
      status: "failed";
      errorCode: string;
      error: string;
      failureKind: NotificationFailureKind;
    };

export type ParsedPushReceipt =
  | { status: "delivered"; ticketId: string }
  | { status: "pending"; ticketId: string }
  | {
      status: "failed";
      ticketId: string;
      errorCode: string;
      error: string;
      failureKind: NotificationFailureKind;
    };

export const EXPO_PUSH_BATCH_SIZE = 100;
export const EXPO_RECEIPT_BATCH_SIZE = 1000;
export const EXPO_RECEIPT_DELAY_MS = 15 * 60 * 1000;
export const EXPO_RECEIPT_MAX_ATTEMPTS = 3;

const PERMANENT_EXPO_ERRORS = new Set([
  "DeviceNotRegistered",
  "InvalidCredentials",
  "MessageTooBig",
  "MismatchSenderId",
]);

export function classifyExpoError(errorCode: string) {
  return PERMANENT_EXPO_ERRORS.has(errorCode)
    ? ("permanent" as const)
    : ("transient" as const);
}

export function classifyHttpFailure(status: number) {
  return status === 408 || status === 429 || status >= 500
    ? ("transient" as const)
    : ("permanent" as const);
}

export function shouldDisableExpoPushToken(errorCode: string | undefined) {
  return errorCode === "DeviceNotRegistered";
}

export function parseExpoPushTickets(payload: unknown, expectedCount: number) {
  const data = getDataArray(payload);
  if (data.length !== expectedCount) {
    throw new Error(
      `Expo returned ${data.length} tickets for ${expectedCount} messages`,
    );
  }
  return data.map(parseTicket);
}

export function parseExpoPushReceipts(payload: unknown, ticketIds: string[]) {
  const data = getDataRecord(payload);
  return ticketIds.map((ticketId) => {
    const receipt = data[ticketId];
    return receipt === undefined
      ? ({ status: "pending", ticketId } satisfies ParsedPushReceipt)
      : parseReceipt(ticketId, receipt);
  });
}

function parseTicket(value: unknown) {
  if (!isRecord(value)) throw new Error("Expo returned an invalid push ticket");
  if (value.status === "ok" && typeof value.id === "string") {
    return {
      status: "accepted",
      ticketId: value.id,
    } satisfies ParsedPushTicket;
  }
  if (value.status === "error") return parseFailure(value);
  throw new Error("Expo returned an invalid push ticket");
}

function parseReceipt(ticketId: string, value: unknown) {
  if (!isRecord(value))
    throw new Error("Expo returned an invalid push receipt");
  if (value.status === "ok") {
    return { status: "delivered", ticketId } satisfies ParsedPushReceipt;
  }
  if (value.status === "error") {
    return { ticketId, ...parseFailure(value) } satisfies ParsedPushReceipt;
  }
  throw new Error("Expo returned an invalid push receipt");
}

function parseFailure(value: Record<string, unknown>) {
  const details = isRecord(value.details) ? value.details : {};
  const errorCode =
    typeof details.error === "string" ? details.error : "UnknownExpoError";
  return {
    status: "failed",
    errorCode,
    error:
      typeof value.message === "string" ? value.message : "Expo push failed",
    failureKind: classifyExpoError(errorCode),
  } satisfies ParsedPushTicket;
}

function getDataArray(payload: unknown) {
  if (!isRecord(payload) || !isUnknownArray(payload.data)) {
    throw new Error("Expo returned an invalid push ticket response");
  }
  return payload.data;
}

function getDataRecord(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error("Expo returned an invalid push receipt response");
  }
  return payload.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
