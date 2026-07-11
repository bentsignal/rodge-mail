import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./relative-time";

const NOW = new Date("2026-07-11T16:00:00.000Z").getTime();

describe("formatRelativeTime", () => {
  it.each([
    [30_000, "now"],
    [2 * 60_000, "2m"],
    [2 * 60 * 60_000, "2h"],
    [2 * 24 * 60 * 60_000, "2d"],
  ])("formats a %i millisecond-old timestamp", (age, expected) => {
    expect(formatRelativeTime(NOW - age, NOW)).toBe(expected);
  });

  it("uses a compact calendar date after a week", () => {
    expect(
      formatRelativeTime(new Date("2026-06-01T12:00:00.000Z").getTime(), NOW),
    ).toBe("Jun 1");
  });

  it("includes the year for older calendar years", () => {
    expect(
      formatRelativeTime(new Date("2025-12-01T12:00:00.000Z").getTime(), NOW),
    ).toBe("Dec 1, 2025");
  });
});
