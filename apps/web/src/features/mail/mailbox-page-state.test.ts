import { describe, expect, it } from "vitest";

import {
  getCanInitializeSearchSelection,
  getIsLoadingInbox,
  getIsSearchingInbox,
} from "./mailbox-page-state";

describe("mailbox page state", () => {
  it("shows initial inbox loading only when there is no cached mail", () => {
    expect(
      getIsLoadingInbox({
        debouncedSearchQuery: "",
        hasCachedPage: false,
        pageStatus: "LoadingFirstPage",
        searchQuery: "",
      }),
    ).toBe(true);
    expect(
      getIsLoadingInbox({
        debouncedSearchQuery: "",
        hasCachedPage: true,
        pageStatus: "LoadingFirstPage",
        searchQuery: "",
      }),
    ).toBe(false);
  });

  it("does not replace a pending search with the inbox loading state", () => {
    expect(
      getIsLoadingInbox({
        debouncedSearchQuery: "",
        hasCachedPage: false,
        pageStatus: "LoadingFirstPage",
        searchQuery: "invoice",
      }),
    ).toBe(false);
  });

  it("does not change list feedback during the debounce interval", () => {
    expect(
      getIsSearchingInbox({
        debouncedSearchQuery: "inv",
        pageStatus: "Exhausted",
      }),
    ).toBe(false);
  });

  it("tracks a first search page until its results settle", () => {
    expect(
      getIsSearchingInbox({
        debouncedSearchQuery: "invoice",
        pageStatus: "LoadingFirstPage",
      }),
    ).toBe(true);
    expect(
      getIsSearchingInbox({
        debouncedSearchQuery: "invoice",
        pageStatus: "CanLoadMore",
      }),
    ).toBe(false);
  });

  it("initializes the reader only from a settled search result set", () => {
    expect(
      getCanInitializeSearchSelection({
        debouncedSearchQuery: "space",
        isSearchingInbox: false,
        searchQuery: "spacex",
      }),
    ).toBe(false);
    expect(
      getCanInitializeSearchSelection({
        debouncedSearchQuery: "spacex",
        isSearchingInbox: true,
        searchQuery: "spacex",
      }),
    ).toBe(false);
    expect(
      getCanInitializeSearchSelection({
        debouncedSearchQuery: "spacex",
        isSearchingInbox: false,
        searchQuery: "spacex",
      }),
    ).toBe(true);
  });
});
