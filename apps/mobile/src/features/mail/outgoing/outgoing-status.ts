import type { SentStatus } from "@rodge-mail/features/mail";

export interface OutgoingSendState {
  error?: string;
  outboxId?: string;
  phase: "enqueuing" | "failed" | "queued";
  subject: string;
}

export interface OutgoingBannerState {
  kind: "failed" | "sending" | "sent";
  message: string;
  outboxId?: string;
}

/** What the send banner says, from the local send and the live outbox. */
export function getOutgoingBannerState(
  send: OutgoingSendState | undefined,
  outbox: readonly { _id: string; error?: string; status: SentStatus }[] = [],
): OutgoingBannerState | undefined {
  if (!send) return undefined;
  if (send.phase === "failed") {
    return { kind: "failed", message: "Couldn’t send" };
  }
  const row = send.outboxId
    ? outbox.find((candidate) => candidate._id === send.outboxId)
    : undefined;
  if (row?.status === "sent") {
    return { kind: "sent", message: "Sent", outboxId: row._id };
  }
  if (row?.status === "failed") {
    return { kind: "failed", message: "Not sent", outboxId: row._id };
  }
  return { kind: "sending", message: "Sending…", outboxId: send.outboxId };
}
