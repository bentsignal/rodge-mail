import { hashPassword } from "better-auth/crypto";
import { describe, expect, it, vi } from "vitest";

import { completePasskeyRecovery } from "./passkeyRecovery";

const email = "owner@example.com";
const identifier = `passkey-recovery-code:${email}`;
const now = Date.UTC(2026, 6, 12, 12);

describe("passkey recovery sign-in", () => {
  it("creates a normal session without changing passkeys", async () => {
    const adapter = await createRecoveryAdapter({ emailVerified: false });
    const setSession = vi.fn(() => Promise.resolve());

    await expect(
      completePasskeyRecovery({
        adapter,
        code: "123456",
        email,
        now,
        setSession,
      }),
    ).resolves.toBe(true);

    expect(adapter.users.get("user-1")?.emailVerified).toBe(true);
    expect(adapter.sessions).toHaveLength(1);
    expect(adapter.passkeys).toEqual(["passkey-1"]);
    expect(adapter.values.has(identifier)).toBe(false);
    expect(setSession).toHaveBeenCalledWith({
      session: adapter.sessions[0],
      user: { emailVerified: true, id: "user-1" },
    });
  });

  it("allows only one session across replayed and concurrent submissions", async () => {
    const adapter = await createRecoveryAdapter();
    const setSession = vi.fn(() => Promise.resolve());

    const results = await Promise.all([
      completePasskeyRecovery({
        adapter,
        code: "123456",
        email,
        now,
        setSession,
      }),
      completePasskeyRecovery({
        adapter,
        code: "123456",
        email,
        now,
        setSession,
      }),
    ]);

    expect(results.sort()).toEqual([false, true]);
    await expect(
      completePasskeyRecovery({
        adapter,
        code: "123456",
        email,
        now,
        setSession,
      }),
    ).resolves.toBe(false);
    expect(adapter.sessions).toHaveLength(1);
    expect(setSession).toHaveBeenCalledTimes(1);
  });
});

describe("passkey recovery safeguards", () => {
  it("preserves expiry while enforcing the three-attempt limit", async () => {
    const expiresAt = new Date(now + 60_000);
    const adapter = await createRecoveryAdapter({ expiresAt });
    const setSession = vi.fn(() => Promise.resolve());

    for (const attempts of [1, 2]) {
      await expect(
        completePasskeyRecovery({
          adapter,
          code: "000000",
          email,
          now,
          setSession,
        }),
      ).resolves.toBe(false);
      const stored = adapter.values.get(identifier);
      expect(stored?.expiresAt).toEqual(expiresAt);
      expect(JSON.parse(stored?.value ?? "{}")).toMatchObject({ attempts });
    }

    await expect(
      completePasskeyRecovery({
        adapter,
        code: "000000",
        email,
        now,
        setSession,
      }),
    ).resolves.toBe(false);
    expect(adapter.values.has(identifier)).toBe(false);
    expect(adapter.sessions).toHaveLength(0);
    expect(setSession).not.toHaveBeenCalled();
  });

  it.each(["expired", "missing-user"] as const)(
    "does not create a session for an %s recovery",
    async (scenario) => {
      const adapter = await createRecoveryAdapter({
        expiresAt:
          scenario === "expired" ? new Date(now) : new Date(now + 60_000),
      });
      if (scenario === "missing-user") adapter.users.clear();
      const setSession = vi.fn(() => Promise.resolve());

      await expect(
        completePasskeyRecovery({
          adapter,
          code: "123456",
          email,
          now,
          setSession,
        }),
      ).resolves.toBe(false);
      expect(adapter.sessions).toHaveLength(0);
      expect(setSession).not.toHaveBeenCalled();
      expect(adapter.values.has(identifier)).toBe(false);
    },
  );

  it("removes an orphan session when cookie persistence fails", async () => {
    const adapter = await createRecoveryAdapter();
    const error = new Error("cookie write failed");

    await expect(
      completePasskeyRecovery({
        adapter,
        code: "123456",
        email,
        now,
        setSession: () => Promise.reject(error),
      }),
    ).rejects.toBe(error);

    expect(adapter.sessions).toHaveLength(0);
    expect(adapter.values.has(identifier)).toBe(false);
  });
});

async function createRecoveryAdapter({
  emailVerified = true,
  expiresAt = new Date(now + 60_000),
}: {
  emailVerified?: boolean;
  expiresAt?: Date;
} = {}) {
  const values = new Map([
    [
      identifier,
      {
        expiresAt,
        identifier,
        value: JSON.stringify({
          attempts: 0,
          codeHash: await hashPassword("123456"),
          userId: "user-1",
        }),
      },
    ],
  ]);
  const users = new Map([["user-1", { emailVerified, id: "user-1" }]]);
  const sessions = new Array<{ token: string; userId: string }>();
  return {
    passkeys: ["passkey-1"],
    sessions,
    users,
    values,
    consumeVerificationValue(key: string) {
      const value = values.get(key) ?? null;
      values.delete(key);
      return Promise.resolve(value);
    },
    createSession(userId: string) {
      const session = { token: `session-${sessions.length + 1}`, userId };
      sessions.push(session);
      return Promise.resolve(session);
    },
    createVerificationValue(value: {
      expiresAt: Date;
      identifier: string;
      value: string;
    }) {
      values.set(value.identifier, value);
      return Promise.resolve();
    },
    deleteSession(token: string) {
      const index = sessions.findIndex((session) => session.token === token);
      if (index >= 0) sessions.splice(index, 1);
      return Promise.resolve();
    },
    deleteVerificationByIdentifier(key: string) {
      values.delete(key);
      return Promise.resolve();
    },
    findUserById(userId: string) {
      return Promise.resolve(users.get(userId) ?? null);
    },
    findVerificationValue(key: string) {
      return Promise.resolve(values.get(key) ?? null);
    },
    updateUser(userId: string, update: { emailVerified: true }) {
      const user = users.get(userId);
      if (!user) throw new Error("user missing");
      const updated = { ...user, ...update };
      users.set(userId, updated);
      return Promise.resolve(updated);
    },
  };
}
