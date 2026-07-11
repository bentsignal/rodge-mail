import { describe, expect, it } from "vitest";

import { isImportantMessage } from "./importance";

describe("normalized message importance", () => {
  it("uses one score threshold without depending on inbox buckets", () => {
    expect(isImportantMessage(0.6)).toBe(true);
    expect(isImportantMessage(0.92)).toBe(true);
    expect(isImportantMessage(0.59)).toBe(false);
    expect(isImportantMessage(undefined)).toBe(false);
    expect(isImportantMessage(Number.NaN)).toBe(false);
  });
});
