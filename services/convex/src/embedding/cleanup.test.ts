import { describe, expect, it } from "vitest";

import { legacyEmbeddingCleanupPlan } from "./cleanup";

describe("legacy embedding cleanup", () => {
  it("reconciles current v2 and explicitly protected records", () => {
    expect(
      legacyEmbeddingCleanupPlan({
        currentClassification: true,
        messageExists: true,
        protectedReason: false,
      }),
    ).toBe("reconcile");
    expect(
      legacyEmbeddingCleanupPlan({
        currentClassification: false,
        messageExists: true,
        protectedReason: true,
      }),
    ).toBe("reconcile");
  });

  it("deletes ancient baselines and orphan records", () => {
    expect(
      legacyEmbeddingCleanupPlan({
        currentClassification: false,
        messageExists: true,
        protectedReason: false,
      }),
    ).toBe("delete");
    expect(
      legacyEmbeddingCleanupPlan({
        currentClassification: true,
        messageExists: false,
        protectedReason: true,
      }),
    ).toBe("delete");
  });
});
