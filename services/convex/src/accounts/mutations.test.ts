import { describe, expect, it, vi } from "vitest";

import {
  MAX_ACCOUNT_DISPLAY_LABEL_LENGTH,
  normalizeAccountDisplayLabel,
} from "./mutations";

vi.mock("../convex.env", () => ({
  env: { AUTH_ALLOWED_USER_ID: "owner" },
}));

describe("account display labels", () => {
  it("trims saved labels and treats blank input as a reset", () => {
    expect(normalizeAccountDisplayLabel("  Family mail  ")).toBe("Family mail");
    expect(normalizeAccountDisplayLabel("   ")).toBeUndefined();
  });

  it("rejects labels beyond the UI and storage limit", () => {
    expect(() =>
      normalizeAccountDisplayLabel(
        "a".repeat(MAX_ACCOUNT_DISPLAY_LABEL_LENGTH + 1),
      ),
    ).toThrow(`Account label must be ${MAX_ACCOUNT_DISPLAY_LABEL_LENGTH}`);
  });
});
