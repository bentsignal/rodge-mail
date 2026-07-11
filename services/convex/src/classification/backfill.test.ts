import { describe, expect, it } from "vitest";

import {
  nextBackfillRemaining,
  RECENT_BACKFILL_LIMIT,
  RECENT_BACKFILL_PAGE_DELAY_MS,
  RECENT_BACKFILL_PAGE_SIZE,
  recentBackfillBounds,
} from "./backfill";

describe("recent classification backfill bounds", () => {
  it("limits work to ten messages per paced page and 200 total", () => {
    expect(RECENT_BACKFILL_LIMIT).toBe(200);
    expect(RECENT_BACKFILL_PAGE_SIZE).toBe(10);
    expect(RECENT_BACKFILL_PAGE_DELAY_MS).toBe(20_000);
    expect(nextBackfillRemaining(200, 10)).toBe(190);
    expect(nextBackfillRemaining(5, 10)).toBe(0);
    expect(nextBackfillRemaining(500, 10)).toBe(190);
  });

  it("uses a 30-day cutoff and rejects implausibly future mail", () => {
    const now = Date.parse("2026-07-11T12:00:00.000Z");
    expect(recentBackfillBounds(now)).toEqual({
      cutoff: now - 30 * 24 * 60 * 60 * 1000,
      upperBound: now + 5 * 60 * 1000,
    });
  });
});
