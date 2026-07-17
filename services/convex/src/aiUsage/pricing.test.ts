import { describe, expect, it } from "vitest";

import {
  calculateModelCostUsd,
  canReserveDailyUsage,
  reserveResponseCostUsd,
  utcDayBounds,
} from "./pricing";

describe("AI usage pricing", () => {
  it("calculates nano input, cached input, and output cost", () => {
    expect(
      calculateModelCostUsd("gpt-5-nano", {
        inputTokens: 1_000_000,
        cachedInputTokens: 200_000,
        outputTokens: 100_000,
      }),
    ).toBeCloseTo(0.081);
  });

  it("reserves at least one input token and the full output allowance", () => {
    expect(
      reserveResponseCostUsd({
        model: "gpt-5-nano",
        inputCharacters: 0,
        maxOutputTokens: 6_000,
      }),
    ).toBeGreaterThan(0.0024);
  });

  it("rejects models without explicit pricing", () => {
    expect(() =>
      calculateModelCostUsd("unpriced-model", { inputTokens: 1 }),
    ).toThrow("pricing is not configured");
  });

  it("uses UTC day boundaries", () => {
    const bounds = utcDayBounds(Date.parse("2026-07-13T23:59:59.999Z"));
    expect(new Date(bounds.start).toISOString()).toBe(
      "2026-07-13T00:00:00.000Z",
    );
    expect(new Date(bounds.end).toISOString()).toBe("2026-07-14T00:00:00.000Z");
  });

  it("allows the exact daily limit and blocks the next reservation", () => {
    expect(canReserveDailyUsage(0.99, 0.01)).toBe(true);
    expect(canReserveDailyUsage(0.99, 0.010_001)).toBe(false);
    expect(canReserveDailyUsage(0, 1.01)).toBe(false);
  });
});
