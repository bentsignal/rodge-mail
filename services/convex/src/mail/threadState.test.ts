import { describe, expect, it } from "vitest";

import {
  getThreadInboxState,
  getThreadProjectionUpdate,
  getThreadRowFlags,
} from "./threadState";

describe("thread inbox projection", () => {
  it("selects exactly the newest inbox message", () => {
    const state = getThreadInboxState([
      { _id: "older", inInbox: true, isPinned: false, receivedAt: 10 },
      { _id: "newer", inInbox: true, isPinned: false, receivedAt: 20 },
      { _id: "sent", inInbox: false, isPinned: false, receivedAt: 30 },
    ]);

    expect(state.latestInboxMessage?._id).toBe("newer");
    expect(state.latestInboxMessageAt).toBe(20);
    expect(state.inInbox).toBe(true);
  });

  it("keeps thread pin state when an older inbox message is pinned", () => {
    const state = getThreadInboxState([
      { _id: "pinned", inInbox: true, isPinned: true, receivedAt: 10 },
      { _id: "latest", inInbox: true, isPinned: false, receivedAt: 20 },
    ]);

    expect(state.latestInboxMessage?._id).toBe("latest");
    expect(state.isPinned).toBe(true);
  });

  it("excludes threads with no inbox messages", () => {
    expect(
      getThreadInboxState([
        { _id: "archived", inInbox: false, isPinned: true, receivedAt: 10 },
      ]),
    ).toMatchObject({
      inInbox: false,
      isPinned: false,
      latestInboxMessage: undefined,
    });
  });

  it("derives unread truth from thread state", () => {
    expect(
      getThreadRowFlags({ unreadCount: 2, isPinned: false }, true),
    ).toEqual({ isRead: false, isPinned: false });
    expect(getThreadRowFlags({ unreadCount: 0 }, true)).toEqual({
      isRead: true,
      isPinned: true,
    });
  });

  it("marks orphan threads outside the inbox during backfill", () => {
    expect(getThreadProjectionUpdate(42, [])).toEqual({
      latestMessageAt: 42,
      latestInboxMessageAt: undefined,
      latestInboxMessageId: undefined,
      inInbox: false,
      isPinned: false,
    });
  });
});
