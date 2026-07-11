import type { NotificationFailureKind } from "./expo";
import { summarizeDeliveryTickets } from "./delivery";

export const NOTIFICATION_SEND_LEASE_MS = 15 * 60 * 1000;

interface RecoveryTicket {
  errorCode?: string;
  expoTicketId?: string;
  failureKind?: NotificationFailureKind;
  status: "delivered" | "failed" | "pending";
}

export function resolveStaleSendingDelivery(tickets: RecoveryTicket[]) {
  if (tickets.length > 0) {
    return {
      patch: summarizeDeliveryTickets(tickets),
      shouldCheckReceipts: tickets.some(
        (ticket) => ticket.status === "pending",
      ),
    };
  }

  return {
    patch: {
      status: "failed" as const,
      acceptedCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      failureKind: "transient" as const,
      error:
        "Push outcome unknown after an interrupted Expo request; not retried to avoid a duplicate notification.",
    },
    shouldCheckReceipts: false,
  };
}
