import { describe, expect, it } from "vitest";

import { embeddingSelectionPlan, preferredReason } from "./storage";

describe("embedding selection", () => {
  it("does not embed a low-importance inbox message", () => {
    expect(
      embeddingSelectionPlan({
        clearSelected: false,
        embeddingReason: undefined,
        importance: 0.59,
        inInbox: true,
        isPinned: false,
        jobReason: undefined,
      }),
    ).toEqual({
      deleteReason: undefined,
      preserveSelected: false,
      reason: null,
    });
  });

  it("cleans up a legacy baseline for low-importance mail", () => {
    expect(
      embeddingSelectionPlan({
        clearSelected: false,
        embeddingReason: "inbox",
        importance: 0.2,
        inInbox: true,
        isPinned: false,
        jobReason: "inbox",
      }),
    ).toEqual({
      deleteReason: "inbox",
      preserveSelected: false,
      reason: null,
    });
  });

  it("embeds an inbox message at the importance threshold", () => {
    expect(
      embeddingSelectionPlan({
        clearSelected: false,
        embeddingReason: "inbox",
        importance: 0.6,
        inInbox: true,
        isPinned: false,
        jobReason: "inbox",
      }),
    ).toEqual({
      deleteReason: undefined,
      preserveSelected: false,
      reason: "important",
    });
  });

  it("keeps a pinned inbox message eligible regardless of importance", () => {
    expect(
      embeddingSelectionPlan({
        clearSelected: false,
        embeddingReason: undefined,
        importance: 0.1,
        inInbox: true,
        isPinned: true,
        jobReason: undefined,
      }),
    ).toEqual({
      deleteReason: undefined,
      preserveSelected: false,
      reason: "pinned",
    });
  });

  it("removes the baseline embedding after a message leaves the inbox", () => {
    expect(
      embeddingSelectionPlan({
        clearSelected: false,
        embeddingReason: "inbox",
        importance: 0.9,
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
});

describe("embedding reason precedence", () => {
  it("does not downgrade a selected or pinned embedding to inbox", () => {
    expect(preferredReason("inbox", "selected", undefined)).toBe("selected");
    expect(preferredReason("inbox", "pinned", undefined)).toBe("pinned");
  });

  it("migrates a legacy focused reason to important", () => {
    expect(preferredReason("important", "focused", undefined)).toBe(
      "important",
    );
  });

  it("preserves explicit selection while refreshing eligibility", () => {
    expect(
      embeddingSelectionPlan({
        clearSelected: false,
        embeddingReason: "selected",
        importance: 0.1,
        inInbox: true,
        isPinned: false,
        jobReason: "selected",
      }),
    ).toEqual({
      deleteReason: undefined,
      preserveSelected: true,
      reason: null,
    });
  });
});
