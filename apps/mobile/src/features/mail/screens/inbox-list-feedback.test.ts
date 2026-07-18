import { describe, expect, it } from "vitest";

import { getEmptyMailboxCopy } from "./mailbox-empty-state";

describe("mailbox empty-state copy", () => {
  it("describes the spam quarantine when it is empty", () => {
    expect(
      getEmptyMailboxCopy({
        filter: "all",
        mailbox: "spam",
      }),
    ).toEqual({
      detail:
        "Messages Rodge Mail flags as spam are quarantined here, away from your inbox.",
      title: "No spam",
    });
  });

  it("keeps search and unread feedback specific", () => {
    expect(
      getEmptyMailboxCopy({
        filter: "all",
        mailbox: "spam",
        searchTerm: "invoice",
      }).title,
    ).toBe("No matching mail");
    expect(
      getEmptyMailboxCopy({
        filter: "unread",
        mailbox: "spam",
      }).title,
    ).toBe("No unread messages");
  });
});
