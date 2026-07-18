import { describe, expect, it } from "vitest";

import {
  getThreadRowAccessibilityLabel,
  isThreadUnread,
} from "./thread-row-presentation";

describe("thread row presentation", () => {
  it("announces the read state without relying on visual styling", () => {
    expect(
      getThreadRowAccessibilityLabel({
        isRead: false,
        senderName: "Ada Lovelace",
        subject: "Analytical engine notes",
      }),
    ).toBe("Ada Lovelace, Analytical engine notes, unread");
    expect(
      getThreadRowAccessibilityLabel({
        isRead: true,
        senderName: "Ada Lovelace",
        subject: "Analytical engine notes",
      }),
    ).toBe("Ada Lovelace, Analytical engine notes, read");
  });

  it("shows the avatar dot only for unread threads", () => {
    expect(isThreadUnread(false)).toBe(true);
    expect(isThreadUnread(true)).toBe(false);
  });
});
