import type { NotificationFailureKind } from "./expo";
import { EXPO_RECEIPT_MAX_ATTEMPTS } from "./expo";

interface TicketOutcome {
  errorCode?: string;
  expoTicketId?: string;
  failureKind?: NotificationFailureKind;
  status: "delivered" | "failed" | "pending";
}

export function summarizeDeliveryTickets(tickets: TicketOutcome[]) {
  const acceptedCount = tickets.filter((ticket) => ticket.expoTicketId).length;
  const deliveredCount = tickets.filter(
    (ticket) => ticket.status === "delivered",
  ).length;
  const failures = tickets.filter((ticket) => ticket.status === "failed");
  const pendingCount = tickets.filter(
    (ticket) => ticket.status === "pending",
  ).length;
  const status = getDeliveryStatus({
    deliveredCount,
    failedCount: failures.length,
    pendingCount,
  });
  return {
    status,
    acceptedCount,
    deliveredCount,
    failedCount: failures.length,
    failureKind: getFailureKind(failures),
    error: summarizeFailures(failures),
  };
}

export function resolveReceiptStatus(
  status: TicketOutcome["status"],
  receiptAttempts: number,
) {
  if (status === "pending" && receiptAttempts >= EXPO_RECEIPT_MAX_ATTEMPTS) {
    return "failed" as const;
  }
  return status;
}

function getDeliveryStatus(counts: {
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
}) {
  if (counts.pendingCount > 0) {
    return counts.failedCount > 0
      ? ("partial" as const)
      : ("accepted" as const);
  }
  if (counts.failedCount === 0) return "sent" as const;
  return counts.deliveredCount > 0 ? ("partial" as const) : ("failed" as const);
}

function getFailureKind(failures: TicketOutcome[]) {
  if (failures.length === 0) return undefined;
  return failures.some((ticket) => ticket.failureKind === "transient")
    ? ("transient" as const)
    : ("permanent" as const);
}

function summarizeFailures(failures: TicketOutcome[]) {
  if (failures.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const failure of failures) {
    const code = failure.errorCode ?? "PushFailed";
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts]
    .map(([code, count]) => `${count} ${code}`)
    .join("; ")
    .slice(0, 500);
}
