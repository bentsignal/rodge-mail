import { describe, expect, it } from "vitest";

import {
  sortInboxMessages,
  toAccountView,
  toUnreadCountRecord,
} from "./live-data-utils";

describe("live mail data utilities", () => {
  it("keeps pinned messages above newer unpinned messages", () => {
    const messages = [
      { _id: "new", isPinned: false, receivedAt: 30, threadId: "new" },
      {
        _id: "older-pinned",
        isPinned: true,
        receivedAt: 10,
        threadId: "older-pinned",
      },
      {
        _id: "newer-pinned",
        isPinned: true,
        receivedAt: 20,
        threadId: "newer-pinned",
      },
    ];

    expect(sortInboxMessages(messages).map((message) => message._id)).toEqual([
      "newer-pinned",
      "older-pinned",
      "new",
    ]);
  });

  it("keeps the unified total separate from authoritative account totals", () => {
    expect(
      toUnreadCountRecord({
        all: 6,
        byAccount: { gmail: 2, icloud: 4, microsoft: 0 },
      }),
    ).toEqual({ all: 6, gmail: 2, icloud: 4, microsoft: 0 });
  });

  it("prefers a custom account label without losing provider identity", () => {
    const account = toAccountView({
      _creationTime: 1,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Branded Convex IDs are compile-time-only in this presentation test.
      _id: "account" as never,
      address: "person@example.com",
      createdAt: 1,
      displayLabel: "Family mail",
      displayName: "Personal Gmail",
      ownerId: "owner",
      provider: "gmail",
      remoteAccountId: "remote",
      status: "connected",
      updatedAt: 1,
    });

    expect(account.label).toBe("Family mail");
    expect(account.displayName).toBe("Personal Gmail");
    expect(account.address).toBe("person@example.com");
  });
});
