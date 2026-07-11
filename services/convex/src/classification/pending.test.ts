import { describe, expect, it } from "vitest";

import { embeddingSelectionPlan } from "../embedding/storage";
import {
  pendingClassificationMetadata,
  requiredClassificationMetadata,
} from "./pending";

describe("pending classification metadata", () => {
  it("starts a new job with required neutral metadata", () => {
    expect(pendingClassificationMetadata(null, "Message preview")).toEqual({
      category: "unclassified",
      confidence: 0,
      importance: 0,
      reason: "Awaiting importance classification",
      shouldEmbed: false,
      summary: "Message preview",
    });
  });

  it("preserves the last classified payload during reclassification", () => {
    const pending = pendingClassificationMetadata(
      {
        category: "action_required",
        confidence: 0.91,
        importance: 0.94,
        reason: "A response is due today.",
        shouldEmbed: true,
        summary: "Reply to the contract question.",
      },
      "New message preview",
    );

    expect(pending).toEqual({
      category: "action_required",
      confidence: 0.91,
      importance: 0.94,
      reason: "A response is due today.",
      shouldEmbed: true,
      summary: "Reply to the contract question.",
    });
    expect(
      embeddingSelectionPlan({
        clearSelected: false,
        embeddingReason: "important",
        importance: pending.importance,
        inInbox: true,
        isPinned: false,
        jobReason: "important",
      }),
    ).toEqual({
      deleteReason: undefined,
      preserveSelected: false,
      reason: "important",
    });
  });

  it("fills only missing legacy metadata", () => {
    expect(
      requiredClassificationMetadata(
        { category: "personal", reason: "Known reason" },
        "Legacy preview",
      ),
    ).toEqual({
      category: "personal",
      reason: "Known reason",
      summary: "Legacy preview",
    });
  });
});
