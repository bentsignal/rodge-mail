import { describe, expect, it } from "vitest";

import { getMailboxPageKey } from "./use-cached-mailbox-page";

describe("mailbox page keys", () => {
  it("separates mailboxes, accounts, and searches", () => {
    const keys = [
      getMailboxPageKey("archive", undefined),
      getMailboxPageKey("archive", "account-1"),
      getMailboxPageKey("spam", undefined),
      getMailboxPageKey("spam", "account-1"),
      getMailboxPageKey("all", "account-1", "lisbon"),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
