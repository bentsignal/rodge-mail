import { describe, expect, it } from "vitest";

import { mergeRecentOutboxes } from "./recent";

describe("recent outbox selection", () => {
  it("keeps unresolved rows alongside newer sent history", () => {
    const failed = { createdAt: 1, id: "failed" };
    const sent = Array.from({ length: 10 }, (_, index) => ({
      createdAt: index + 2,
      id: `sent-${index}`,
    }));

    const result = mergeRecentOutboxes([[failed], sent]);

    expect(result).toHaveLength(11);
    expect(result.at(-1)).toBe(failed);
  });

  it("orders merged status groups by creation time", () => {
    expect(
      mergeRecentOutboxes([
        [{ createdAt: 2, id: "sending" }],
        [{ createdAt: 3, id: "pending" }],
        [{ createdAt: 1, id: "failed" }],
      ]).map((row) => row.id),
    ).toEqual(["pending", "sending", "failed"]);
  });
});
