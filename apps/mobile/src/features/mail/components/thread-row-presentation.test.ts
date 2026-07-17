import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPinAction,
  getReadAction,
  getSenderInitials,
  getThreadRowAccessibilityLabel,
  getThreadRowNativeKey,
  isThreadUnread,
  runAfterSwipeAnimation,
} from "./thread-row-presentation";

afterEach(() => vi.useRealTimers());

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

  it("refreshes native actions after thread state changes", () => {
    const base = { id: "thread-1", isPinned: false, isRead: true };
    const pinned = { ...base, isPinned: true };
    const unread = { ...base, isRead: false };
    expect(getThreadRowNativeKey(base)).toBe("thread-1:unpinned:read");
    expect(getThreadRowNativeKey(pinned)).not.toBe(getThreadRowNativeKey(base));
    expect(getThreadRowNativeKey(unread)).not.toBe(getThreadRowNativeKey(base));
  });

  it("applies swipe state after the native close animation", () => {
    vi.useFakeTimers();
    const action = vi.fn();

    runAfterSwipeAnimation(action);
    vi.advanceTimersByTime(299);
    expect(action).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(action).toHaveBeenCalledOnce();
  });
});
