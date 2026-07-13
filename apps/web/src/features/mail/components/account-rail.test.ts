import { describe, expect, it } from "vitest";

import {
  getAccountButtonLabel,
  getAccountRailMailboxTarget,
} from "./account-rail-presentation";

describe("account rail unread labels", () => {
  it("announces authoritative unread totals with each mailbox", () => {
    expect(getAccountButtonLabel("All Inboxes", 6)).toBe(
      "All Inboxes, 6 unread",
    );
    expect(getAccountButtonLabel("Gmail", 0)).toBe("Gmail");
  });

  it("always leaves Archive when a mailbox is selected", () => {
    expect(getAccountRailMailboxTarget()).toBe("/");
  });
});
