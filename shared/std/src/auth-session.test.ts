import { describe, expect, it, vi } from "vitest";

import { completeAuthSession } from "./auth-session";

describe("auth session completion", () => {
  it("refreshes immediately after an unambiguous success", async () => {
    const confirmSession = vi.fn();
    const refreshSession = vi.fn();

    await completeAuthSession({
      authenticate: () => Promise.resolve({ error: null }),
      confirmSession,
      fallbackMessage: "Sign-in failed",
      refreshSession,
    });

    expect(confirmSession).not.toHaveBeenCalled();
    expect(refreshSession).toHaveBeenCalledOnce();
  });

  it("accepts a reported error when the session was persisted", async () => {
    const refreshSession = vi.fn();

    await completeAuthSession({
      authenticate: () =>
        Promise.resolve({ error: { message: "auth cancelled" } }),
      confirmSession: () =>
        Promise.resolve({ data: { session: { id: "session" } } }),
      fallbackMessage: "Sign-in failed",
      refreshSession,
    });

    expect(refreshSession).toHaveBeenCalledOnce();
  });

  it("accepts a thrown client error when the session was persisted", async () => {
    const refreshSession = vi.fn();

    await completeAuthSession({
      authenticate: () =>
        Promise.reject(new Error("The response could not be read")),
      confirmSession: () =>
        Promise.resolve({ data: { session: { id: "session" } } }),
      fallbackMessage: "Sign-in failed",
      refreshSession,
    });

    expect(refreshSession).toHaveBeenCalledOnce();
  });

  it("preserves a genuine authentication error without a session", async () => {
    await expect(
      completeAuthSession({
        authenticate: () =>
          Promise.resolve({
            error: { message: "No matching passkey" },
          }),
        confirmSession: () => Promise.resolve({ data: null }),
        fallbackMessage: "Sign-in failed",
        refreshSession: vi.fn(),
      }),
    ).rejects.toThrow("No matching passkey");
  });

  it("preserves the original error when session confirmation also fails", async () => {
    await expect(
      completeAuthSession({
        authenticate: () =>
          Promise.reject(new Error("Authentication timed out")),
        confirmSession: () => Promise.reject(new Error("Network unavailable")),
        fallbackMessage: "Sign-in failed",
        refreshSession: vi.fn(),
      }),
    ).rejects.toThrow("Authentication timed out");
  });
});
