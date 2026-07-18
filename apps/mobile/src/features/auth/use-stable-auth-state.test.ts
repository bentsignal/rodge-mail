import { describe, expect, it } from "vitest";

import { resolveStableAuthState } from "./use-stable-auth-state";

describe("stable auth state", () => {
  it("shows loading only before the first resolved session", () => {
    expect(
      resolveStableAuthState(
        { isAuthenticated: false, isLoading: true },
        undefined,
      ),
    ).toEqual({
      isAuthenticated: false,
      isInitialLoading: true,
      lastResolved: undefined,
    });
  });

  it("keeps the sign-in screen mounted during sign-in revalidation", () => {
    expect(
      resolveStableAuthState(
        { isAuthenticated: false, isLoading: true },
        false,
      ),
    ).toEqual({
      isAuthenticated: false,
      isInitialLoading: false,
      lastResolved: false,
    });
  });

  it("keeps authenticated navigation mounted during sign-out revalidation", () => {
    expect(
      resolveStableAuthState({ isAuthenticated: false, isLoading: true }, true),
    ).toEqual({
      isAuthenticated: true,
      isInitialLoading: false,
      lastResolved: true,
    });
  });

  it("adopts the next resolved auth state", () => {
    expect(
      resolveStableAuthState(
        { isAuthenticated: false, isLoading: false },
        true,
      ),
    ).toEqual({
      isAuthenticated: false,
      isInitialLoading: false,
      lastResolved: false,
    });
  });
});
