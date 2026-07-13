import { describe, expect, it } from "vitest";

import {
  filterMailboxThreads,
  getFilterLabel,
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
  it("filters read and unread mail without reordering all mail", () => {
    expect(filterMailboxThreads(threads, "all")).toBe(threads);
    expect(filterMailboxThreads(threads, "read").map(({ id }) => id)).toEqual([
      "read",
    ]);
    expect(filterMailboxThreads(threads, "unread").map(({ id }) => id)).toEqual(
      ["unread"],
    );
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
    expect(getFilterLabel("all")).toBe("Filter");
    expect(getFilterLabel("read")).toBe("Read");
    expect(getFilterLabel("unread")).toBe("Unread");
  });
});
