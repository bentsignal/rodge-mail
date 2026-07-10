import { describe, expect, it } from "vitest";

import { consumeDesktopAuthHandoff, createCodeChallenge } from "./desktopAuth";

const requestId = "R".repeat(43);
const verifier = "V".repeat(43);
const authorizationCode = "A".repeat(43);
const identifier = `desktop-auth:${requestId}`;

function createAdapter(
  value: {
    authorizationCodeHash?: string;
    codeChallenge: string;
    userId?: string;
  },
  expiresAt: Date | number | string = new Date(Date.now() + 60_000),
) {
  const records = new Map([
    [identifier, { expiresAt, value: JSON.stringify(value) }],
  ]);
  return {
    records,
    consumeVerificationValue: (key: string) => {
      const record = records.get(key) ?? null;
      records.delete(key);
      return Promise.resolve(record);
    },
    findVerificationValue: (key: string) =>
      Promise.resolve(records.get(key) ?? null),
  };
}

describe("desktop authentication handoff", () => {
  it("consumes an authorized handoff exactly once", async () => {
    const codeChallenge = await createCodeChallenge(verifier);
    const authorizationCodeHash = await createCodeChallenge(authorizationCode);
    const adapter = createAdapter({
      authorizationCodeHash,
      codeChallenge,
      userId: "user-1",
    });

    await expect(
      consumeDesktopAuthHandoff(
        adapter,
        { authorizationCode, codeVerifier: verifier, requestId },
        Date.now(),
      ),
    ).resolves.toEqual({
      authorizationCodeHash,
      codeChallenge,
      userId: "user-1",
    });
    await expect(
      consumeDesktopAuthHandoff(
        adapter,
        { authorizationCode, codeVerifier: verifier, requestId },
        Date.now(),
      ),
    ).resolves.toBeUndefined();
  });

  it("does not consume a handoff for the wrong verifier", async () => {
    const codeChallenge = await createCodeChallenge(verifier);
    const authorizationCodeHash = await createCodeChallenge(authorizationCode);
    const adapter = createAdapter({
      authorizationCodeHash,
      codeChallenge,
      userId: "user-1",
    });

    await expect(
      consumeDesktopAuthHandoff(
        adapter,
        {
          authorizationCode,
          codeVerifier: "X".repeat(43),
          requestId,
        },
        Date.now(),
      ),
    ).resolves.toBeUndefined();
    expect(adapter.records.has(identifier)).toBe(true);
  });
});

describe("desktop authentication claim binding", () => {
  it("rejects an attacker who has the request and verifier but no authorization code", async () => {
    const codeChallenge = await createCodeChallenge(verifier);
    const authorizationCodeHash = await createCodeChallenge(authorizationCode);
    const adapter = createAdapter({
      authorizationCodeHash,
      codeChallenge,
      userId: "user-1",
    });

    await expect(
      consumeDesktopAuthHandoff(
        adapter,
        { codeVerifier: verifier, requestId },
        Date.now(),
      ),
    ).resolves.toBeUndefined();
    expect(adapter.records.has(identifier)).toBe(true);
  });

  it("rejects an interceptor who has the request and authorization code but no verifier", async () => {
    const codeChallenge = await createCodeChallenge(verifier);
    const authorizationCodeHash = await createCodeChallenge(authorizationCode);
    const adapter = createAdapter({
      authorizationCodeHash,
      codeChallenge,
      userId: "user-1",
    });

    await expect(
      consumeDesktopAuthHandoff(
        adapter,
        { authorizationCode, requestId },
        Date.now(),
      ),
    ).resolves.toBeUndefined();
    expect(adapter.records.has(identifier)).toBe(true);
  });
});

describe("desktop authentication adapter values", () => {
  it.each([
    ["epoch milliseconds", Date.now() + 60_000],
    ["ISO string", new Date(Date.now() + 60_000).toISOString()],
  ])("accepts an unexpired %s from the adapter", async (_label, expiresAt) => {
    const codeChallenge = await createCodeChallenge(verifier);
    const authorizationCodeHash = await createCodeChallenge(authorizationCode);
    const adapter = createAdapter(
      { authorizationCodeHash, codeChallenge, userId: "user-1" },
      expiresAt,
    );

    await expect(
      consumeDesktopAuthHandoff(
        adapter,
        { authorizationCode, codeVerifier: verifier, requestId },
        Date.now(),
      ),
    ).resolves.toEqual({
      authorizationCodeHash,
      codeChallenge,
      userId: "user-1",
    });
  });

  it("rejects and preserves expired handoffs for cleanup", async () => {
    const codeChallenge = await createCodeChallenge(verifier);
    const authorizationCodeHash = await createCodeChallenge(authorizationCode);
    const adapter = createAdapter(
      { authorizationCodeHash, codeChallenge, userId: "user-1" },
      new Date(Date.now() - 1),
    );

    await expect(
      consumeDesktopAuthHandoff(
        adapter,
        { authorizationCode, codeVerifier: verifier, requestId },
        Date.now(),
      ),
    ).resolves.toBeUndefined();
    expect(adapter.records.has(identifier)).toBe(true);
  });
});
