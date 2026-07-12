import { describe, expect, it } from "vitest";

import { matchesUnreadScope, matchesUnreadThreadScope } from "./unread";

describe("unread query scope", () => {
  it("includes only threads with unread messages when active", () => {
    expect(matchesUnreadThreadScope(true, { unreadCount: 2 })).toBe(true);
    expect(matchesUnreadThreadScope(true, { unreadCount: 0 })).toBe(false);
    expect(matchesUnreadThreadScope(false, { unreadCount: 0 })).toBe(true);
  });

  it("filters semantic message hydration with the same scope", () => {
    expect(matchesUnreadScope(true, { isRead: false })).toBe(true);
    expect(matchesUnreadScope(true, { isRead: true })).toBe(false);
    expect(matchesUnreadScope(undefined, { isRead: true })).toBe(true);
  });
});
