import { describe, expect, it } from "vitest";

import {
  ARCHIVE_RETENTION_MS,
  getArchiveRetentionCutoff,
  isProviderMessageArchived,
  validateArchiveCleanupLimit,
} from "./archive";

describe("archive retention", () => {
  it("retains archived message records for thirty days", () => {
    expect(getArchiveRetentionCutoff(ARCHIVE_RETENTION_MS + 123)).toBe(123);
  });

  it("accepts only bounded cleanup batches", () => {
    expect(() => validateArchiveCleanupLimit(1)).not.toThrow();
    expect(() => validateArchiveCleanupLimit(100)).not.toThrow();
    expect(() => validateArchiveCleanupLimit(0)).toThrow();
    expect(() => validateArchiveCleanupLimit(101)).toThrow();
    expect(() => validateArchiveCleanupLimit(1.5)).toThrow();
  });

  it("suppresses provider resurrection before and after record cleanup", () => {
    expect(isProviderMessageArchived({ archivedAt: 10 }, undefined)).toBe(true);
    expect(isProviderMessageArchived(undefined, { archivedAt: 10 })).toBe(true);
    expect(isProviderMessageArchived(undefined, undefined)).toBe(false);
  });

  it("keeps legacy hidden records suppressed", () => {
    expect(isProviderMessageArchived({ hiddenAt: 10 }, undefined)).toBe(true);
  });
});
