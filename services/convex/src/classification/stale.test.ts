import { describe, expect, it } from "vitest";

import {
  CLASSIFICATION_JOB_STALE_AFTER_MS,
  classificationRecoveryPlan,
} from "./stale";

const now = Date.parse("2026-07-11T12:00:00.000Z");
const message = { inInbox: true, receivedAt: now - 60_000 };

function classification(
  overrides: Partial<{
    attempt: number;
    nextAttemptAt: number;
    source: "manual" | "model" | "rules";
    status: "classified" | "failed" | "pending" | "running";
    updatedAt: number;
  }> = {},
) {
  return {
    attempt: 1,
    source: "rules" as const,
    status: "pending" as const,
    updatedAt: now - CLASSIFICATION_JOB_STALE_AFTER_MS,
    ...overrides,
  };
}

describe("stale classification recovery", () => {
  it.each(["pending", "running"] as const)(
    "retries an abandoned %s job without resetting its attempt",
    (status) => {
      expect(
        classificationRecoveryPlan(
          classification({ attempt: 2, status }),
          message,
          now,
        ),
      ).toBe("retry");
    },
  );

  it("waits for pending backoff and ignores recent work", () => {
    expect(
      classificationRecoveryPlan(
        classification({ nextAttemptAt: now + 1 }),
        message,
        now,
      ),
    ).toBeNull();
    expect(
      classificationRecoveryPlan(
        classification({
          updatedAt: now - CLASSIFICATION_JOB_STALE_AFTER_MS + 1,
        }),
        message,
        now,
      ),
    ).toBeNull();
  });

  it("uses deterministic fallback after the final model attempt", () => {
    expect(
      classificationRecoveryPlan(
        classification({ attempt: 3, status: "running" }),
        message,
        now,
      ),
    ).toBe("fallback");
  });

  it("discards unfinished work outside the recent inbox window", () => {
    expect(
      classificationRecoveryPlan(
        classification(),
        { inInbox: false, receivedAt: now },
        now,
      ),
    ).toBe("discard");
    expect(
      classificationRecoveryPlan(
        classification(),
        { inInbox: true, receivedAt: now - 30 * 24 * 60 * 60 * 1000 - 1 },
        now,
      ),
    ).toBe("discard");
    expect(classificationRecoveryPlan(classification(), null, now)).toBe(
      "discard",
    );
  });

  it("never recovers manual or terminal classifications", () => {
    expect(
      classificationRecoveryPlan(
        classification({ source: "manual" }),
        message,
        now,
      ),
    ).toBeNull();
    expect(
      classificationRecoveryPlan(
        classification({ status: "classified" }),
        message,
        now,
      ),
    ).toBeNull();
  });
});
