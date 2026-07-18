import { describe, expect, it } from "vitest";

import { resolveArchiveTransitionResults } from "./archive-live-data";

describe("archive search transitions", () => {
  it("keeps the last settled rows while a new search is pending", () => {
    const settledResults = [{ id: "previous" }];

    expect(
      resolveArchiveTransitionResults({
        candidateResults: [],
        isPending: true,
        settledResults,
      }),
    ).toBe(settledResults);
  });

  it("reveals the new result set after the search settles", () => {
    const candidateResults = [{ id: "next" }];

    expect(
      resolveArchiveTransitionResults({
        candidateResults,
        isPending: false,
        settledResults: [{ id: "previous" }],
      }),
    ).toBe(candidateResults);
  });
});
