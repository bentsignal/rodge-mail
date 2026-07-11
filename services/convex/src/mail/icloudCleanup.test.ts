import { describe, expect, it } from "vitest";

import { ICLOUD_SYNC_LOOKBACK_MS } from "../providers/icloud/window";
import {
  buildThreadAfterMessageCleanup,
  MAX_ICLOUD_CLEANUP_MESSAGES,
  summarizeICloudCleanup,
  validateICloudCleanupArgs,
} from "./icloudCleanup";

describe("iCloud message cleanup", () => {
  it("bounds every mutation batch and requires a real cutoff", () => {
    const now = ICLOUD_SYNC_LOOKBACK_MS + 10;
    expect(() =>
      validateICloudCleanupArgs({ cutoffReceivedAt: 1, limit: 1 }, now),
    ).not.toThrow();
    expect(() =>
      validateICloudCleanupArgs(
        {
          cutoffReceivedAt: 1,
          limit: MAX_ICLOUD_CLEANUP_MESSAGES + 1,
        },
        now,
      ),
    ).toThrow(/limit must be an integer/);
    expect(() =>
      validateICloudCleanupArgs(
        { cutoffReceivedAt: Number.NaN, limit: 1 },
        now,
      ),
    ).toThrow(/positive timestamp/);
    expect(() =>
      validateICloudCleanupArgs({ cutoffReceivedAt: 11, limit: 1 }, now),
    ).toThrow(/preserve the active iCloud window/);
  });

  it("counts related rows while deduplicating storage and threads", () => {
    expect(
      summarizeICloudCleanup([
        {
          attachments: 2,
          classifications: 1,
          contents: 1,
          embeddingJobs: 1,
          embeddings: 1,
          notificationDeliveries: 1,
          notificationPushTickets: 2,
          storageIds: ["shared", "body"],
          threadId: "thread",
        },
        {
          attachments: 1,
          classifications: 0,
          contents: 1,
          embeddingJobs: 0,
          embeddings: 0,
          notificationDeliveries: 0,
          notificationPushTickets: 0,
          storageIds: ["shared", "attachment"],
          threadId: "thread",
        },
      ]),
    ).toEqual({
      attachments: 3,
      classifications: 1,
      contents: 2,
      embeddingJobs: 1,
      embeddings: 1,
      messages: 2,
      notificationDeliveries: 1,
      notificationPushTickets: 2,
      storageObjects: 3,
      threads: 1,
    });
  });
});

describe("iCloud cleanup thread recalculation", () => {
  it("deletes a thread projection when its final message is removed", () => {
    expect(buildThreadAfterMessageCleanup([], 100)).toBeNull();
  });

  it("fully recalculates a surviving thread from remaining messages", () => {
    const sent = message({
      _id: "sent",
      receivedAt: 30,
      subject: "Latest sent",
      snippet: "sent snippet",
      inInbox: false,
      isRead: true,
      hasAttachments: true,
    });
    const inbox = message({
      _id: "inbox",
      receivedAt: 20,
      subject: "Inbox",
      snippet: "inbox snippet",
      inInbox: true,
      isPinned: true,
      isRead: false,
    });

    expect(buildThreadAfterMessageCleanup([sent, inbox], 100)).toEqual(
      expect.objectContaining({
        subject: "Latest sent",
        snippet: "sent snippet",
        latestMessageAt: 20,
        latestInboxMessageAt: 20,
        latestInboxMessageId: inbox._id,
        messageCount: 2,
        unreadCount: 1,
        inInbox: true,
        isPinned: true,
        hasAttachments: true,
        updatedAt: 100,
      }),
    );
  });
});

function message(overrides: Partial<TestMessage> & Pick<TestMessage, "_id">) {
  const { _id, ...rest } = overrides;
  return {
    _id,
    from: { address: "sender@example.com", name: "Sender" },
    to: [{ address: "owner@example.com" }],
    cc: [],
    subject: "Subject",
    snippet: "Snippet",
    receivedAt: 1,
    hasAttachments: false,
    inInbox: false,
    isRead: true,
    isPinned: false,
    ...rest,
  } satisfies TestMessage;
}

interface TestMessage {
  _id: string;
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
