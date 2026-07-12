import { describe, expect, it, vi } from "vitest";

import { completeEmailCodeSignIn } from "./email-code-sign-in";

describe("email code sign-in", () => {
  it("returns the safe requested destination after verification", async () => {
    const verify = vi.fn().mockResolvedValue({
      data: { success: true },
      error: null,
    });

    await expect(
      completeEmailCodeSignIn(verify, "/desktop-auth?request_id=request"),
    ).resolves.toBe("/desktop-auth?request_id=request");
    expect(verify).toHaveBeenCalledOnce();
  });

  it("rejects failed or incomplete verification", async () => {
    await expect(
      completeEmailCodeSignIn(
        () =>
          Promise.resolve({
            data: null,
            error: { message: "Code expired" },
          }),
        undefined,
      ),
    ).rejects.toThrow("Code expired");

    await expect(
      completeEmailCodeSignIn(
        () => Promise.resolve({ data: { success: false }, error: null }),
        undefined,
      ),
    ).rejects.toThrow("The sign-in code is invalid or expired");
  });
});
