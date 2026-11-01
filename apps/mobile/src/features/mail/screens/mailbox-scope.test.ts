import { describe, expect, it } from "vitest";

import {
  getAccountAddressDetail,
  getMailboxTitle,
  getSelectedAccountLabel,
} from "./mailbox-scope";

describe("mailbox scope", () => {
  it("titles the view after its mailbox", () => {
    expect(getMailboxTitle("inbox", "all")).toBe("All Inboxes");
    expect(getMailboxTitle("inbox", "account-1")).toBe("Inbox");
    expect(getMailboxTitle("all", "account-1")).toBe("All Mail");
    expect(getMailboxTitle("sent", "all")).toBe("Sent");
    expect(getMailboxTitle("archive", "account-1")).toBe("Archive");
    expect(getMailboxTitle("spam", "all")).toBe("Spam");
  });

  it("names only a selected account", () => {
    const accounts = [{ id: "account-1", label: "Personal" }];
    expect(getSelectedAccountLabel("all", accounts)).toBeUndefined();
    expect(getSelectedAccountLabel("account-1", accounts)).toBe("Personal");
    expect(getSelectedAccountLabel("removed", accounts)).toBeUndefined();
  });

  it("repeats an address only when the name differs", () => {
    expect(
      getAccountAddressDetail({ address: "a@example.com", label: "Personal" }),
    ).toBe("a@example.com");
    expect(
      getAccountAddressDetail({
        address: "a@example.com",
        label: "a@example.com",
      }),
    ).toBeUndefined();
  });
});
