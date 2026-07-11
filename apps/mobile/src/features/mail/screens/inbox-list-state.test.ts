import { describe, expect, it } from "vitest";

import { getVisibleInboxThreads } from "./inbox-list-state";

const inboxThreads = [
  { id: "read", isRead: true },
  { id: "unread", isRead: false },
];
const searchThreads = [{ id: "match", isRead: false }];

describe("getVisibleInboxThreads", () => {
  it("switches to search results while searching", () => {
    expect(
      getVisibleInboxThreads({
        inboxThreads,
        isSearching: true,
        searchThreads,
        showUnreadOnly: false,
      }),
    ).toEqual(searchThreads);
  });

  it("filters the active result set to unread mail", () => {
    expect(
      getVisibleInboxThreads({
        inboxThreads,
        isSearching: false,
        searchThreads,
        showUnreadOnly: true,
      }),
    ).toEqual([{ id: "unread", isRead: false }]);
  });
});
