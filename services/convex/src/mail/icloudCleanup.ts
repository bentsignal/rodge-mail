import { ICLOUD_SYNC_LOOKBACK_MS } from "../providers/icloud/window";
import { getThreadInboxState } from "./threadState";

export const MAX_ICLOUD_CLEANUP_MESSAGES = 50;

export interface ICloudCleanupCounts {
  attachments: number;
  classifications: number;
  contents: number;
  embeddingJobs: number;
  embeddings: number;
  messages: number;
  notificationDeliveries: number;
  notificationPushTickets: number;
  storageObjects: number;
  threads: number;
}

export function validateICloudCleanupArgs(
  args: {
    cutoffReceivedAt: number;
    limit: number;
  },
  now = Date.now(),
) {
  if (!Number.isFinite(args.cutoffReceivedAt) || args.cutoffReceivedAt <= 0) {
    throw new Error("cutoffReceivedAt must be a positive timestamp");
  }
  if (
    !Number.isInteger(args.limit) ||
    args.limit < 1 ||
    args.limit > MAX_ICLOUD_CLEANUP_MESSAGES
  ) {
    throw new Error(
      `limit must be an integer between 1 and ${MAX_ICLOUD_CLEANUP_MESSAGES}`,
    );
  }
  if (args.cutoffReceivedAt > now - ICLOUD_SYNC_LOOKBACK_MS) {
    throw new Error("cutoffReceivedAt must preserve the active iCloud window");
  }
}

export function emptyICloudCleanupCounts() {
  return {
    attachments: 0,
    classifications: 0,
    contents: 0,
    embeddingJobs: 0,
    embeddings: 0,
    messages: 0,
    notificationDeliveries: 0,
    notificationPushTickets: 0,
    storageObjects: 0,
    threads: 0,
  };
}

export function summarizeICloudCleanup(
  records: {
    attachments: number;
    classifications: number;
    contents: number;
    embeddingJobs: number;
    embeddings: number;
    notificationDeliveries: number;
    notificationPushTickets: number;
    storageIds: string[];
    threadId: string;
  }[],
) {
  const counts = records.reduce(
    (total, record) => ({
      ...total,
      attachments: total.attachments + record.attachments,
      classifications: total.classifications + record.classifications,
      contents: total.contents + record.contents,
      embeddingJobs: total.embeddingJobs + record.embeddingJobs,
      embeddings: total.embeddings + record.embeddings,
      messages: total.messages + 1,
      notificationDeliveries:
        total.notificationDeliveries + record.notificationDeliveries,
      notificationPushTickets:
        total.notificationPushTickets + record.notificationPushTickets,
    }),
    emptyICloudCleanupCounts(),
  );
  return {
    ...counts,
    storageObjects: new Set(records.flatMap((record) => record.storageIds))
      .size,
    threads: new Set(records.map((record) => record.threadId)).size,
  };
}

export function buildThreadAfterMessageCleanup<TId extends string>(
  messages: CleanupThreadMessage<TId>[],
  updatedAt: number,
) {
  if (messages.length === 0) return null;
  const latest = messages.reduce((current, message) =>
    message.receivedAt > current.receivedAt ? message : current,
  );
  const inboxState = getThreadInboxState(messages);
  return {
    subject: latest.subject,
    snippet: latest.snippet,
    participants: uniqueAddresses(
      messages.flatMap((message) => [
        message.from,
        ...message.to,
        ...message.cc,
      ]),
    ),
    latestMessageAt:
      inboxState.latestInboxMessage?.receivedAt ?? latest.receivedAt,
    latestInboxMessageAt: inboxState.latestInboxMessageAt,
    latestInboxMessageId: inboxState.latestInboxMessageId,
    messageCount: messages.length,
    unreadCount: messages.filter((message) => !message.isRead).length,
    inInbox: inboxState.inInbox,
    isPinned: inboxState.isPinned,
    hasAttachments: messages.some((message) => message.hasAttachments),
    updatedAt,
  };
}

interface CleanupThreadMessage<TId extends string> {
  _id: TId;
  cc: { address: string; name?: string }[];
  from: { address: string; name?: string };
  hasAttachments: boolean;
  inInbox: boolean;
  isPinned: boolean;
  isRead: boolean;
  receivedAt: number;
  snippet: string;
  subject: string;
  to: { address: string; name?: string }[];
}

function uniqueAddresses(addresses: { address: string; name?: string }[]) {
  return [
    ...new Map(
      addresses.map((address) => [address.address.toLowerCase(), address]),
    ).values(),
  ];
}
