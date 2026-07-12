import { describe, expect, it, vi } from "vitest";

import { completeRecoverySignIn } from "./passkey-recovery-client";

describe("completeRecoverySignIn", () => {
  it("accepts a recovery response that establishes the session", async () => {
    const verify = vi.fn().mockResolvedValue({
      data: { success: true },
      error: null,
    });

    await expect(
      completeRecoverySignIn({
        code: "123456",
        email: "ada@example.com",
        verify,
      }),
    ).resolves.toEqual({ success: true });
    expect(verify).toHaveBeenCalledExactlyOnceWith({
      code: "123456",
      email: "ada@example.com",
    });
  });

  it("keeps the server recovery error for the code screen", async () => {
    await expect(
      completeRecoverySignIn({
        code: "654321",
        email: "ada@example.com",
        verify: vi.fn().mockResolvedValue({
          error: { message: "The sign-in code is invalid or expired" },
        }),
      }),
    ).resolves.toEqual({
      message: "The sign-in code is invalid or expired",
      success: false,
    });
  });

  it("rejects a malformed success response", async () => {
    await expect(
      completeRecoverySignIn({
        code: "123456",
        email: "ada@example.com",
        verify: vi.fn().mockResolvedValue({ data: { success: false } }),
      }),
    ).resolves.toEqual({
      message: "The sign-in code is invalid or expired",
      success: false,
    });
  });
});
