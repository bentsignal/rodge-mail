import { describe, expect, it, vi } from "vitest";

import { shouldHoldSplash } from "./use-launch-splash";

vi.mock("expo-splash-screen", () => ({ hideAsync: vi.fn() }));

describe("launch splash", () => {
  it("stays up while fonts and colors load", () => {
    expect(
      shouldHoldSplash({
        appIsReady: false,
        authIsLoading: false,
        authWaitExpired: false,
      }),
    ).toBe(true);
  });

  it("stays up until the session is known", () => {
    expect(
      shouldHoldSplash({
        appIsReady: true,
        authIsLoading: true,
        authWaitExpired: false,
      }),
    ).toBe(true);
    expect(
      shouldHoldSplash({
        appIsReady: true,
        authIsLoading: false,
        authWaitExpired: false,
      }),
    ).toBe(false);
  });

  it("lets go when the session check runs too long", () => {
    expect(
      shouldHoldSplash({
        appIsReady: true,
        authIsLoading: true,
        authWaitExpired: true,
      }),
    ).toBe(false);
  });
});
