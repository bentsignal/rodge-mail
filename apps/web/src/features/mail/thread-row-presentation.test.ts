import { describe, expect, it } from "vitest";

import { getUnreadThreadRowClass } from "./thread-row-presentation";

describe("thread row presentation", () => {
  it("adds the unread rail only when selection does not already mark the row", () => {
    expect(getUnreadThreadRowClass(false, false)).toBe(
      "mail-thread-row-unread",
    );
    expect(getUnreadThreadRowClass(false, true)).toBeUndefined();
    expect(getUnreadThreadRowClass(true, false)).toBeUndefined();
  });
});
