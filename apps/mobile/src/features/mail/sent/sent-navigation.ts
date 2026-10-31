import { isOptimisticOutboxId } from "../outgoing/outbox-optimistic";

/**
 * Delivered mail whose provider copy is in the mailbox opens in the reader at
 * that message; anything else opens the outbox copy with its status.
 */
export function getSentRowTarget(row: {
  _id: string;
  messageId?: string;
  threadId?: string;
}) {
  if (isOptimisticOutboxId(row._id)) return undefined;
  if (row.threadId && row.messageId) {
    return `/(tabs)/(inbox)/thread/${row.threadId}?messageId=${row.messageId}` as const;
  }
  return `/(tabs)/(inbox)/sent/${row._id}` as const;
}
