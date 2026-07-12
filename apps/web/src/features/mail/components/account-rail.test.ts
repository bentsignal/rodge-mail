import { describe, expect, it } from "vitest";

import { getAccountButtonLabel } from "./account-rail-presentation";

describe("account rail unread labels", () => {
  it("announces authoritative unread totals with each mailbox", () => {
    expect(getAccountButtonLabel("Unified inbox", 6)).toBe(
      "Unified inbox, 6 unread",
    );
    expect(getAccountButtonLabel("Gmail", 0)).toBe("Gmail");
  });
});
