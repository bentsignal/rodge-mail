import { describe, expect, it } from "vitest";

import {
  filterMailboxThreads,
  getFilterLabel,
  getMailboxSearchPlaceholder,
  parseMobileMailbox,
  toggleSelectedThread,
} from "./mailbox-controls";

const threads = [makeThread("read", true), makeThread("unread", false)];

function makeThread(id: string, isRead: boolean) {
  return {
    accountId: "account",
    id,
    isPinned: false,
    isRead,
    messages: [],
    preview: "Preview",
    receivedAt: "2026-07-13T00:00:00.000Z",
    sender: { address: "sender@example.com", name: "Sender" },
    subject: "Subject",
  };
}

describe("mailbox controls", () => {
  it("preserves supported mailbox routes", () => {
    expect(parseMobileMailbox("archive")).toBe("archive");
    expect(parseMobileMailbox("spam")).toBe("spam");
    expect(parseMobileMailbox("unknown")).toBe("inbox");
    expect(parseMobileMailbox(undefined)).toBe("inbox");
  });

  it("uses mailbox-specific search language", () => {
    expect(getMailboxSearchPlaceholder("archive")).toBe("Search archive");
    expect(getMailboxSearchPlaceholder("spam")).toBe("Search spam");
    expect(getMailboxSearchPlaceholder("inbox")).toBeUndefined();
  });

  it("filters unread mail without reordering all mail", () => {
    expect(filterMailboxThreads(threads, "all")).toBe(threads);
    expect(filterMailboxThreads(threads, "unread").map(({ id }) => id)).toEqual(
      ["unread"],
    );
  });

  it("retains an opened thread for the current unread-filter session", () => {
    expect(
      filterMailboxThreads(threads, "unread", new Set(["read"])).map(
        ({ id }) => id,
      ),
    ).toEqual(["read", "unread"]);
  });

  it("toggles selection without mutating the previous set", () => {
    const selected = new Set(["read"]);
    const added = toggleSelectedThread(selected, "unread");
    const removed = toggleSelectedThread(added, "read");

    expect([...selected]).toEqual(["read"]);
    expect([...added]).toEqual(["read", "unread"]);
    expect([...removed]).toEqual(["unread"]);
  });

  it("uses the active filter as the toolbar label", () => {
    expect(getFilterLabel("all")).toBe("All");
    expect(getFilterLabel("unread")).toBe("Unread");
  });
});
