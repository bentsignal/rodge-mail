import { describe, expect, it } from "vitest";

import { getMailboxScopeKey } from "./mailbox-page";

describe("mailbox page scope", () => {
  it("separates unread, mailbox, and search cache entries", () => {
    const unified = getMailboxScopeKey(undefined, "", false);

    expect(getMailboxScopeKey(undefined, "", true)).not.toBe(unified);
    expect(getMailboxScopeKey("account-1", "", false)).not.toBe(unified);
    expect(getMailboxScopeKey(undefined, "invoice", false)).not.toBe(unified);
  });
});
