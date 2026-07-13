import { describe, expect, it } from "vitest";

import {
  getMailboxTransitionPending,
  getMailboxViewScopeKey,
  resolveMailboxTransitionResults,
} from "./mailbox-page-transition";

describe("mailbox page transitions", () => {
  it("keeps the last settled view while the next query loads", () => {
    const settled = [{ id: "previous" }];

    expect(
      resolveMailboxTransitionResults({
        candidateResults: [],
        fallbackIsCached: false,
        isPending: true,
        settledResults: settled,
      }),
    ).toEqual({ hasStablePage: true, results: settled });
  });

  it("reveals a true zero-result page after all search work settles", () => {
    expect(
      resolveMailboxTransitionResults({
        candidateResults: [],
        fallbackIsCached: true,
        isPending: false,
        settledResults: [{ id: "previous" }],
      }),
    ).toEqual({ hasStablePage: true, results: [] });
  });

  it("never shares transition snapshots across mailbox or unread scopes", () => {
    const unified = getMailboxViewScopeKey(undefined, false);

    expect(getMailboxViewScopeKey("account-1", false)).not.toBe(unified);
    expect(getMailboxViewScopeKey(undefined, true)).not.toBe(unified);
  });

  it("waits only for the lexical page before revealing search results", () => {
    expect(getMailboxTransitionPending("LoadingFirstPage")).toBe(true);
    expect(getMailboxTransitionPending("Exhausted")).toBe(false);
    expect(getMailboxTransitionPending("CanLoadMore")).toBe(false);
  });
});
