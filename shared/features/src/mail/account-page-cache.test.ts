import { describe, expect, it } from "vitest";

import { readCachedAccountPage } from "./account-page-cache";

const accountOne = { accountId: "account-1", id: "message-1" };
const accountTwo = { accountId: "account-2", id: "message-2" };

describe("account page cache", () => {
  it("returns an exact cached page, including an empty one", () => {
    const cache = new Map([["account-1", []]]);

    expect(
      readCachedAccountPage({
        accountId: "account-1",
        cache,
        key: "account-1",
        unifiedKey: "all",
      }),
    ).toEqual({ isCached: true, items: [] });
  });

  it("derives a first account view from the cached unified page", () => {
    const cache = new Map([["all", [accountOne, accountTwo]]]);

    expect(
      readCachedAccountPage({
        accountId: "account-1",
        cache,
        key: "account-1",
        unifiedKey: "all",
      }),
    ).toEqual({ isCached: true, items: [accountOne] });
  });

  it("does not treat an absent account subset as a complete cached page", () => {
    const cache = new Map([["all", [accountTwo]]]);

    expect(
      readCachedAccountPage({
        accountId: "account-1",
        cache,
        key: "account-1",
        unifiedKey: "all",
      }),
    ).toEqual({ isCached: false, items: [] });
  });
});
