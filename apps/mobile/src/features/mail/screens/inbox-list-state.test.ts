import { describe, expect, it } from "vitest";

import {
  getInboxListFeedback,
  getVisibleInboxThreads,
} from "./inbox-list-state";

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

  it("keeps the prior search results while the next query starts", () => {
    const previousSearchThreads = [{ id: "previous", isRead: false }];

    expect(
      getVisibleInboxThreads({
        inboxThreads,
        isSearching: true,
        searchIsPending: true,
        searchThreads: [],
        settledSearchThreads: previousSearchThreads,
        showUnreadOnly: false,
      }),
    ).toBe(previousSearchThreads);
  });

  it("keeps the inbox visible while the first search query starts", () => {
    expect(
      getVisibleInboxThreads({
        inboxThreads,
        isSearching: true,
        searchIsPending: true,
        searchThreads: [],
        showUnreadOnly: false,
      }),
    ).toBe(inboxThreads);
  });
});

describe("getInboxListFeedback", () => {
  it("stays blank while the first rows load", () => {
    expect(
      getInboxListFeedback({
        emptyIsLoading: false,
        footerIsLoading: true,
        resultCount: 0,
      }),
    ).toEqual({ emptyIsLoading: true, footerIsLoading: false, isReady: false });
  });

  it("keeps pagination loading in the footer when rows are visible", () => {
    expect(
      getInboxListFeedback({
        emptyIsLoading: false,
        footerIsLoading: true,
        resultCount: 4,
      }),
    ).toEqual({ emptyIsLoading: false, footerIsLoading: true, isReady: true });
  });

  it("shows the empty state only once the query has returned empty", () => {
    expect(
      getInboxListFeedback({
        emptyIsLoading: false,
        footerIsLoading: false,
        resultCount: 0,
      }),
    ).toEqual({ emptyIsLoading: false, footerIsLoading: false, isReady: true });
  });

  it("shows rows that are already here while more load", () => {
    expect(
      getInboxListFeedback({
        emptyIsLoading: true,
        footerIsLoading: false,
        resultCount: 3,
      }).isReady,
    ).toBe(true);
  });
});
