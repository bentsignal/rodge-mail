import { describe, expect, it } from "vitest";

import {
  getPinAction,
  getReadAction,
  getSenderInitials,
  getThreadRowAccessibilityLabel,
  getThreadRowNativeKey,
  isThreadUnread,
} from "./thread-row-presentation";

const thread = {
  isPinned: false,
  isRead: false,
  sender: { address: "ada@example.com", name: "Ada Lovelace" },
  subject: "Analytical engine notes",
};

describe("thread row presentation", () => {
  it("builds compact sender initials", () => {
    expect(getSenderInitials("Ada Lovelace")).toBe("AL");
    expect(getSenderInitials("  Prince  ")).toBe("P");
  });

  it("announces unread and pinned state", () => {
    expect(getThreadRowAccessibilityLabel({ ...thread, isPinned: true })).toBe(
      "Ada Lovelace, Analytical engine notes, unread, pinned",
    );
    expect(
      getThreadRowAccessibilityLabel({
        ...thread,
        isPinned: false,
        isRead: true,
      }),
    ).toBe("Ada Lovelace, Analytical engine notes, read");
  });

  it("describes the inverse action for the current state", () => {
    expect(getPinAction(thread)).toEqual({ label: "Pin", systemImage: "pin" });
    expect(getPinAction({ isPinned: true }).label).toBe("Unpin");
    expect(getReadAction(thread).label).toBe("Mark Read");
    expect(getReadAction({ isRead: true }).label).toBe("Mark Unread");
  });

  it("shows unread emphasis only for unread threads", () => {
    expect(isThreadUnread(thread)).toBe(true);
    expect(isThreadUnread({ isRead: true })).toBe(false);
  });

  it("remounts native actions when their source state changes", () => {
    const base = { id: "thread-1", isPinned: false, isRead: true };
    expect(getThreadRowNativeKey(base)).toBe("thread-1:unpinned:read");
    expect(getThreadRowNativeKey({ ...base, isPinned: true })).not.toBe(
      getThreadRowNativeKey(base),
    );
    expect(getThreadRowNativeKey({ ...base, isRead: false })).not.toBe(
      getThreadRowNativeKey(base),
    );
  });
});
