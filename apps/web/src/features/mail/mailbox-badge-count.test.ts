import { describe, expect, it } from "vitest";

import { getMailboxBadgeCount } from "./mailbox-badge-count";

describe("mailbox badge count", () => {
  const unreadCounts = { all: 12, gmail: 7, icloud: 5 };

  it("uses the authoritative unread total for unified and account inboxes", () => {
    expect(
      getMailboxBadgeCount({
        accountFilter: "all",
        archivedCount: 30,
        mailMode: "inbox",
        unreadCounts,
      }),
    ).toBe(12);
    expect(
      getMailboxBadgeCount({
        accountFilter: "gmail",
        archivedCount: 30,
        mailMode: "inbox",
        unreadCounts,
      }),
    ).toBe(7);
  });

  it("shows zero for an inbox with no unread threads", () => {
    expect(
      getMailboxBadgeCount({
        accountFilter: "microsoft",
        archivedCount: 30,
        mailMode: "inbox",
        unreadCounts,
      }),
    ).toBe(0);
  });

  it("keeps the archive message count", () => {
    expect(
      getMailboxBadgeCount({
        accountFilter: "all",
        archivedCount: 30,
        mailMode: "archive",
        unreadCounts,
      }),
    ).toBe(30);
  });
});
