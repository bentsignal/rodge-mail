import { describe, expect, it } from "vitest";

import { resolveNotificationPreferences } from "./preferences";

describe("notification preference inheritance", () => {
  it("requires explicit notification opt-in", () => {
    expect(resolveNotificationPreferences(undefined, undefined)).toEqual({
      includePreview: true,
      newMailEnabled: false,
    });
  });

  it("inherits global values without an account override", () => {
    expect(
      resolveNotificationPreferences(
        { includePreview: false, newMailEnabled: false },
        undefined,
      ),
    ).toEqual({ includePreview: false, newMailEnabled: false });
  });

  it("overrides fields independently per account", () => {
    expect(
      resolveNotificationPreferences(
        { includePreview: false, newMailEnabled: true },
        { newMailEnabled: false },
      ),
    ).toEqual({ includePreview: false, newMailEnabled: false });
  });
});
