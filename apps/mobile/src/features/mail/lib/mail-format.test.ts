import { describe, expect, it } from "vitest";

import { formatInboxMessageTime } from "./mail-format";

const NOW = new Date("2026-07-15T16:00:00.000Z").getTime();

describe("formatInboxMessageTime", () => {
  it.each([
    ["2026-07-15T15:58:00.000Z", "2m"],
    ["2026-07-15T14:00:00.000Z", "2h"],
    ["2026-07-13T16:00:00.000Z", "2d"],
    ["2026-07-01T16:00:00.000Z", "Jul 1"],
  ])("formats %s using the desktop inbox thresholds", (value, expected) => {
    expect(formatInboxMessageTime(value, NOW)).toBe(expected);
  });
});
