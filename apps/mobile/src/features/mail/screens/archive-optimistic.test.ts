import { describe, expect, it } from "vitest";

import { removeArchivedThread } from "./archive-optimistic";

describe("removeArchivedThread", () => {
  it("removes only the deleted thread", () => {
    const threads = [
      { subject: "First", threadId: "thread-1" },
      { subject: "Second", threadId: "thread-2" },
    ];

    expect(removeArchivedThread(threads, "thread-1")).toEqual([
      { subject: "Second", threadId: "thread-2" },
    ]);
  });

  it("preserves rows when the thread is not present", () => {
    const threads = [{ subject: "First", threadId: "thread-1" }];

    expect(removeArchivedThread(threads, "thread-2")).toEqual(threads);
  });
});
