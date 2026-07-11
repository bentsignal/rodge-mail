import { describe, expect, it } from "vitest";

import { EMBEDDING_JOB_STALE_AFTER_MS, isStaleEmbeddingJob } from "./stale";

describe("stale embedding jobs", () => {
  const now = 20 * 60 * 1000;

  it.each(["pending", "running"] as const)(
    "recovers an abandoned %s job",
    (status) => {
      expect(
        isStaleEmbeddingJob(
          { status, updatedAt: now - EMBEDDING_JOB_STALE_AFTER_MS },
          now,
        ),
      ).toBe(true);
    },
  );

  it("leaves a recent running job alone", () => {
    expect(
      isStaleEmbeddingJob(
        {
          status: "running",
          updatedAt: now - EMBEDDING_JOB_STALE_AFTER_MS + 1,
        },
        now,
      ),
    ).toBe(false);
  });

  it.each(["embedded", "failed"] as const)(
    "does not recover a terminal %s job",
    (status) => {
      expect(isStaleEmbeddingJob({ status, updatedAt: 0 }, now)).toBe(false);
    },
  );
});
