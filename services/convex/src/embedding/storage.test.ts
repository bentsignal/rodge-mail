import { describe, expect, it } from "vitest";

import { embeddingSelectionPlan, preferredReason } from "./storage";

describe("embedding selection", () => {
  it("keeps every inbox message eligible for unified search", () => {
    expect(
      embeddingSelectionPlan({
        bucket: "other",
        clearSelected: false,
        embeddingReason: undefined,
        inInbox: true,
        isPinned: false,
        jobReason: undefined,
      }),
    ).toEqual({
      deleteReason: undefined,
      preserveSelected: false,
      reason: "inbox",
    });
  });

  it("removes the baseline embedding after a message leaves the inbox", () => {
    expect(
      embeddingSelectionPlan({
        bucket: "other",
        clearSelected: false,
        embeddingReason: "inbox",
        inInbox: false,
        isPinned: false,
        jobReason: "inbox",
      }),
    ).toEqual({
      deleteReason: "inbox",
      preserveSelected: false,
      reason: null,
    });
  });

  it("does not downgrade a selected or pinned embedding to inbox", () => {
    expect(preferredReason("inbox", "selected", undefined)).toBe("selected");
    expect(preferredReason("inbox", "pinned", undefined)).toBe("pinned");
  });
});
