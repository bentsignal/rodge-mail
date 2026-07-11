import { describe, expect, it } from "vitest";

import {
  canCompleteClassification,
  canRecordClassificationFailure,
  classificationRequestKey,
} from "./jobHelpers";

function classification(
  status: "classified" | "failed" | "pending" | "running",
) {
  return { jobKey: "job-v2", source: "rules" as const, status };
}

describe("classification terminal fences", () => {
  it("uses a fresh idempotency key for each model attempt", () => {
    expect(classificationRequestKey("job-v2", 1, 100)).toBe(
      "job-v2:attempt-1:100",
    );
    expect(classificationRequestKey("job-v2", 2, 200)).not.toBe(
      classificationRequestKey("job-v2", 1, 100),
    );
  });

  it.each(["running", "failed"] as const)(
    "allows the first completion from %s",
    (status) => {
      expect(canCompleteClassification(classification(status), "job-v2")).toBe(
        true,
      );
    },
  );

  it("prevents a recovered fallback from overwriting a late model result", () => {
    expect(
      canCompleteClassification(classification("classified"), "job-v2"),
    ).toBe(false);
  });

  it("rejects stale keys and pending completion", () => {
    expect(
      canCompleteClassification(classification("running"), "old-job"),
    ).toBe(false);
    expect(canCompleteClassification(classification("pending"), "job-v2")).toBe(
      false,
    );
  });

  it("records failures only while the same attempt is running", () => {
    expect(
      canRecordClassificationFailure(classification("running"), "job-v2"),
    ).toBe(true);
    expect(
      canRecordClassificationFailure(classification("classified"), "job-v2"),
    ).toBe(false);
    expect(
      canRecordClassificationFailure(classification("failed"), "job-v2"),
    ).toBe(false);
  });
});
