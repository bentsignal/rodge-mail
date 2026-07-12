import { describe, expect, it } from "vitest";

import { getIsLoadingInbox, getIsSearchingInbox } from "./mailbox-page-state";

describe("mailbox page state", () => {
  it("shows initial inbox loading only when there is no cached mail", () => {
    expect(
      getIsLoadingInbox({
        debouncedSearchQuery: "",
        hasVisibleMessages: false,
        pageStatus: "LoadingFirstPage",
        searchQuery: "",
      }),
    ).toBe(true);
    expect(
      getIsLoadingInbox({
        debouncedSearchQuery: "",
        hasVisibleMessages: true,
        pageStatus: "LoadingFirstPage",
        searchQuery: "",
      }),
    ).toBe(false);
  });

  it("does not replace a pending search with the inbox loading state", () => {
    expect(
      getIsLoadingInbox({
        debouncedSearchQuery: "",
        hasVisibleMessages: false,
        pageStatus: "LoadingFirstPage",
        searchQuery: "invoice",
      }),
    ).toBe(false);
  });

  it("tracks the debounce interval as active search work", () => {
    expect(
      getIsSearchingInbox({
        debouncedSearchQuery: "inv",
        pageStatus: "Exhausted",
        searchQuery: "invoice",
      }),
    ).toBe(true);
  });

  it("tracks a first search page until its results settle", () => {
    expect(
      getIsSearchingInbox({
        debouncedSearchQuery: "invoice",
        pageStatus: "LoadingFirstPage",
        searchQuery: "invoice",
      }),
    ).toBe(true);
    expect(
      getIsSearchingInbox({
        debouncedSearchQuery: "invoice",
        pageStatus: "CanLoadMore",
        searchQuery: "invoice",
      }),
    ).toBe(false);
  });
});
