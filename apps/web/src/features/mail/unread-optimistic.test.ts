import { describe, expect, it } from "vitest";

import {
  getOptimisticUnreadCounts,
  updateOptimisticThreadRows,
} from "./unread-optimistic";

describe("optimistic unread state", () => {
  it("updates unified and account totals together without going negative", () => {
    expect(
      getOptimisticUnreadCounts(
        { all: 6, byAccount: { gmail: 2, icloud: 4 } },
        "gmail",
        true,
      ),
    ).toEqual({ all: 5, byAccount: { gmail: 1, icloud: 4 } });
    expect(
      getOptimisticUnreadCounts(
        { all: 0, byAccount: { gmail: 0 } },
        "gmail",
        true,
      ),
    ).toEqual({ all: 0, byAccount: { gmail: 0 } });
  });

  it("removes a read thread from unread-only pages", () => {
    const rows = [
      { isRead: false, threadId: "thread-1" },
      { isRead: false, threadId: "thread-2" },
    ];

    expect(
      updateOptimisticThreadRows(
        rows,
        { isRead: true, threadId: "thread-1" },
        true,
      ),
    ).toEqual([{ isRead: false, threadId: "thread-2" }]);
  });

  it("updates rows in normal inbox and search pages", () => {
    expect(
      updateOptimisticThreadRows(
        [{ isRead: false, threadId: "thread-1" }],
        { isRead: true, threadId: "thread-1" },
        false,
      ),
    ).toEqual([{ isRead: true, threadId: "thread-1" }]);
  });
});
