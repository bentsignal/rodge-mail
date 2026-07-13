import { describe, expect, it } from "vitest";

import {
  forgetUnreadSessionMessage,
  getUnreadSessionMessages,
  getUnreadSessionScopeKey,
  mergeUnreadSessionMessages,
  preserveUnreadSessionMessage,
} from "./unread-session";

const unreadMessage = {
  isRead: false,
  subject: "Keep me visible",
  threadId: "thread-1",
};

describe("unread view session", () => {
  it("retains a newly read message until the unread scope changes", () => {
    const snapshot = preserveUnreadSessionMessage(
      undefined,
      "all:unread:",
      unreadMessage,
    );

    expect(
      mergeUnreadSessionMessages(
        [{ isRead: false, subject: "Still unread", threadId: "thread-2" }],
        getUnreadSessionMessages(snapshot, "all:unread:", true),
      ),
    ).toEqual([
      { isRead: false, subject: "Still unread", threadId: "thread-2" },
      { ...unreadMessage, isRead: true },
    ]);
    expect(
      getUnreadSessionMessages(snapshot, "account-1:unread:", true),
    ).toEqual([]);
    expect(getUnreadSessionMessages(snapshot, "all:unread:", false)).toEqual(
      [],
    );
  });

  it("starts a fresh scope after leaving and returning to unread", () => {
    expect(getUnreadSessionScopeKey(undefined, "", 1)).not.toBe(
      getUnreadSessionScopeKey(undefined, "", 2),
    );
  });

  it("uses live rows when a preserved message returns to the query", () => {
    const snapshot = preserveUnreadSessionMessage(
      undefined,
      "all:unread:",
      unreadMessage,
    );
    const liveMessage = { ...unreadMessage, isRead: false };

    expect(
      mergeUnreadSessionMessages(
        [liveMessage],
        getUnreadSessionMessages(snapshot, "all:unread:", true),
      ),
    ).toEqual([liveMessage]);
  });

  it("forgets mail removed from the inbox during the same session", () => {
    const snapshot = preserveUnreadSessionMessage(
      undefined,
      "all:unread:",
      unreadMessage,
    );
    const next = forgetUnreadSessionMessage(
      snapshot,
      "all:unread:",
      unreadMessage.threadId,
    );

    expect(getUnreadSessionMessages(next, "all:unread:", true)).toEqual([]);
  });
});
