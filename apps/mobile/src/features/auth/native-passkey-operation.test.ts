import { describe, expect, it, vi } from "vitest";

import {
  getPasskeySignInErrorMessage,
  incompatiblePasskeyMessage,
  retryTransientPasskeyAssociation,
} from "./native-passkey-operation";

const associationError = {
  error: {
    message:
      "ERR_GET_PASSKEY: Unable to verify webcredentials association of bundle with domain rodge-mail.local",
  },
};

describe("native passkey association retry", () => {
  it("retries a returned iOS association failure once", async () => {
    const success = { data: { session: true }, error: null };
    const operation = vi
      .fn()
      .mockResolvedValueOnce(associationError)
      .mockResolvedValueOnce(success);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryTransientPasskeyAssociation(operation, wait),
    ).resolves.toBe(success);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledOnce();
  });

  it("retries a thrown iOS association failure once", async () => {
    const success = { data: { session: true }, error: null };
    const operation = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Unable to verify webcredentials association of bundle"),
      )
      .mockResolvedValueOnce(success);

    await expect(
      retryTransientPasskeyAssociation(operation, () => Promise.resolve()),
    ).resolves.toBe(success);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry other passkey errors", async () => {
    const cancellation = {
      error: { message: "The passkey request was cancelled" },
    };
    const operation = vi.fn().mockResolvedValue(cancellation);

    await expect(
      retryTransientPasskeyAssociation(operation, () => Promise.resolve()),
    ).resolves.toBe(cancellation);
    expect(operation).toHaveBeenCalledOnce();
  });
});

describe("native passkey sign-in errors", () => {
  it("explains how to replace a passkey from the former relying party", () => {
    const error = new Error(
      "ERR_GET_PASSKEY: The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)",
    );

    expect(getPasskeySignInErrorMessage(error)).toBe(
      incompatiblePasskeyMessage,
    );
  });

  it("preserves other native passkey errors", () => {
    expect(getPasskeySignInErrorMessage(new Error("Passkey unavailable"))).toBe(
      "Passkey unavailable",
    );
  });
});
