import { describe, expect, it } from "vitest";

import { getUnreadCountSummary } from "./unreadCounts";

describe("unread count summary", () => {
  it("counts unread threads once across unified and account scopes", () => {
    expect(
      getUnreadCountSummary([
        { accountId: "gmail", unreadCount: 3 },
        { accountId: "gmail", unreadCount: 1 },
        { accountId: "icloud", unreadCount: 2 },
        { accountId: "microsoft", unreadCount: 0 },
      ]),
    ).toEqual({ all: 3, byAccount: { gmail: 2, icloud: 1 } });
  });

  it("excludes threads outside the inbox", () => {
    expect(
      getUnreadCountSummary([
        { accountId: "gmail", inInbox: false, unreadCount: 2 },
      ]),
    ).toEqual({ all: 0, byAccount: {} });
  });
});
