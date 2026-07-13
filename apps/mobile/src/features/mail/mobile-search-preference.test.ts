import { describe, expect, it } from "vitest";

import { isTemporaryIos27SearchEnabled } from "./mobile-search-mode";

describe("temporary iOS 27 search mode", () => {
  it("is opt-in on iOS", () => {
    expect(isTemporaryIos27SearchEnabled("ios", false)).toBe(false);
    expect(isTemporaryIos27SearchEnabled("ios", true)).toBe(true);
  });

  it("never replaces the platform search on other platforms", () => {
    expect(isTemporaryIos27SearchEnabled("android", true)).toBe(false);
    expect(isTemporaryIos27SearchEnabled("web", true)).toBe(false);
  });
});
