import { describe, expect, it } from "vitest";

import {
  normalizeMailRouteSearch,
  toMailboxLinkSearch,
  withMailboxSearch,
  withUnreadSearch,
} from "./mail-route-search";

describe("mail route search", () => {
  it("normalizes deep-linked unread and mailbox scopes", () => {
    expect(
      normalizeMailRouteSearch({ mailbox: "account-1", unread: "true" }),
    ).toEqual({ mailbox: "account-1", unread: true });
    expect(normalizeMailRouteSearch({ mailbox: 42, unread: false })).toEqual({
      mailbox: undefined,
      unread: undefined,
    });
  });

  it("preserves unread when navigating between mailboxes", () => {
    expect(withMailboxSearch({ unread: true }, "account-1")).toEqual({
      mailbox: "account-1",
      unread: true,
    });
    expect(
      withMailboxSearch({ mailbox: "account-1", unread: true }, "all"),
    ).toEqual({ mailbox: undefined, unread: true });
  });

  it("keeps only the account when moving to another mailbox", () => {
    expect(toMailboxLinkSearch({ mailbox: "account-1", unread: true })).toEqual(
      {
        mailbox: "account-1",
      },
    );
    expect(toMailboxLinkSearch({ unread: true })).toEqual({
      mailbox: undefined,
    });
  });

  it("preserves the mailbox when toggling unread", () => {
    expect(withUnreadSearch({ mailbox: "account-1" }, true)).toEqual({
      mailbox: "account-1",
      unread: true,
    });
    expect(
      withUnreadSearch({ mailbox: "account-1", unread: true }, false),
    ).toEqual({ mailbox: "account-1", unread: undefined });
  });
});
