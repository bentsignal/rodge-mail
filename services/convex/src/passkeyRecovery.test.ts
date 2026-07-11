import { describe, expect, it } from "vitest";

import {
  consumePasskeyRecoveryGrant,
  createPasskeyRecoveryGrant,
  resolvePasskeyRecoveryUser,
} from "./passkeyRecovery";

describe("passkey recovery grants", () => {
  it("stores a hashed single-use grant without creating a session", async () => {
    const adapter = createVerificationAdapter();
    const token = await createPasskeyRecoveryGrant(adapter, "user-1");

    expect([...adapter.values.keys()][0]).not.toContain(token);
    await expect(resolvePasskeyRecoveryUser(adapter, token)).resolves.toEqual({
      userId: "user-1",
    });
    await expect(consumePasskeyRecoveryGrant(adapter, token)).resolves.toEqual({
      userId: "user-1",
    });
    await expect(
      resolvePasskeyRecoveryUser(adapter, token),
    ).resolves.toBeUndefined();
    await expect(
      consumePasskeyRecoveryGrant(adapter, token),
    ).resolves.toBeUndefined();
  });

  it("does not resolve a different token", async () => {
    const adapter = createVerificationAdapter();
    await createPasskeyRecoveryGrant(adapter, "user-1");

    await expect(
      resolvePasskeyRecoveryUser(adapter, "unrelated-token"),
    ).resolves.toBeUndefined();
  });
});

function createVerificationAdapter() {
  const values = new Map<
    string,
    { expiresAt: Date; identifier: string; value: string }
  >();
  return {
    values,
    consumeVerificationValue(identifier: string) {
      const value = values.get(identifier) ?? null;
      values.delete(identifier);
      return Promise.resolve(value);
    },
    createVerificationValue(value: {
      expiresAt: Date;
      identifier: string;
      value: string;
    }) {
      values.set(value.identifier, value);
      return Promise.resolve();
    },
    deleteVerificationByIdentifier(identifier: string) {
      values.delete(identifier);
      return Promise.resolve();
    },
    findVerificationValue(identifier: string) {
      return Promise.resolve(values.get(identifier) ?? null);
    },
  };
}
