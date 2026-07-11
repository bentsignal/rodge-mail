import { describe, expect, it } from "vitest";

import { mergeSearchResults } from "./search";

describe("smart search result merging", () => {
  it("keeps lexical order and appends unique semantic results", () => {
    expect(
      mergeSearchResults(
        [{ id: "exact" }, { id: "both" }],
        [{ id: "both" }, { id: "semantic" }],
        (item) => item.id,
      ),
    ).toEqual([{ id: "exact" }, { id: "both" }, { id: "semantic" }]);
  });
});
