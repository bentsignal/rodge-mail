import { describe, expect, it } from "vitest";

import { dedupeThreadRows } from "./thread-rows";

describe("thread row compatibility", () => {
  it("keeps one stable row per thread in caller order", () => {
    expect(
      dedupeThreadRows([
        { id: "latest-a", threadId: "a" },
        { id: "latest-b", threadId: "b" },
        { id: "older-a", threadId: "a" },
      ]),
    ).toEqual([
      { id: "latest-a", threadId: "a" },
      { id: "latest-b", threadId: "b" },
    ]);
  });
});
