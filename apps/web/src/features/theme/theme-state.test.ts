import { describe, expect, it } from "vitest";

import { resolveThemePreference } from "./utils";

describe("web appearance state", () => {
  it("uses the SSR preference until next-themes is ready", () => {
    expect(resolveThemePreference(undefined, "dark")).toBe("dark");
  });

  it("uses next-themes as the live mode source", () => {
    expect(resolveThemePreference("light", "dark")).toBe("light");
    expect(resolveThemePreference("system", "dark")).toBe("system");
  });

  it("safely normalizes an invalid stored mode", () => {
    expect(resolveThemePreference("sepia", "light")).toBe("system");
  });
});
