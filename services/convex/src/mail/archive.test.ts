import { describe, expect, it } from "vitest";

import {
  ARCHIVE_RETENTION_MS,
  getArchiveRetentionCutoff,
  getRestoredInboxFlags,
  isPermanentlyDeletableArchive,
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

  it("restores original inbox membership without promoting sent mail", () => {
    expect(
      getRestoredInboxFlags([
        { archivedFromInbox: true, direction: "incoming" },
        { archivedFromInbox: false, direction: "outgoing" },
      ]),
    ).toEqual([true, false]);
  });

  it("infers legacy restore membership and keeps a thread visible", () => {
    expect(
      getRestoredInboxFlags([
        { direction: "outgoing" },
        { direction: "outgoing" },
      ]),
    ).toEqual([false, true]);
  });

  it("only permits permanent deletion for fully archived threads", () => {
    const archivedThread = { archivedAt: 10, inInbox: false };
    expect(
      isPermanentlyDeletableArchive(archivedThread, [
        { archivedAt: 10, inInbox: false },
      ]),
    ).toBe(true);
    expect(
      isPermanentlyDeletableArchive(archivedThread, [
        { archivedAt: 10, inInbox: true },
      ]),
    ).toBe(false);
    expect(
      isPermanentlyDeletableArchive({ inInbox: true }, [{ inInbox: true }]),
    ).toBe(false);
  });
});
