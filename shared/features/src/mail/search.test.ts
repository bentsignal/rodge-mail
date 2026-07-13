import { describe, expect, it } from "vitest";

import {
  getStrongSemanticMessageIds,
  mergeSearchResults,
  SEMANTIC_SEARCH_MIN_SCORE,
} from "./search";

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

  it("drops weak semantic matches before they can pollute lexical results", () => {
    expect(
      getStrongSemanticMessageIds([
        { messageId: "strong", score: SEMANTIC_SEARCH_MIN_SCORE },
        { messageId: "weak", score: SEMANTIC_SEARCH_MIN_SCORE - 0.01 },
      ]),
    ).toEqual(["strong"]);
  });
});
