import { describe, expect, it } from "vitest";

import {
  getMobileThemeUpdateOrder,
  resolveMobileColorScheme,
} from "./mobile-appearance";

describe("resolveMobileColorScheme", () => {
  it("keeps an explicit app appearance authoritative", () => {
    expect(resolveMobileColorScheme("dark", "light")).toBe("dark");
    expect(resolveMobileColorScheme("light", "dark")).toBe("light");
  });

  it("follows the current system appearance in system mode", () => {
    expect(resolveMobileColorScheme("system", "dark")).toBe("dark");
    expect(resolveMobileColorScheme("system", "light")).toBe("light");
    expect(resolveMobileColorScheme("system", null)).toBe("light");
  });
});

describe("getMobileThemeUpdateOrder", () => {
  it("writes the resolved active palette last", () => {
    expect(getMobileThemeUpdateOrder("light", "dark")).toEqual([
      "dark",
      "light",
    ]);
    expect(getMobileThemeUpdateOrder("dark", "light")).toEqual([
      "light",
      "dark",
    ]);
    expect(getMobileThemeUpdateOrder("system", "light")).toEqual([
      "dark",
      "light",
    ]);
    expect(getMobileThemeUpdateOrder("system", "dark")).toEqual([
      "light",
      "dark",
    ]);
  });
});
