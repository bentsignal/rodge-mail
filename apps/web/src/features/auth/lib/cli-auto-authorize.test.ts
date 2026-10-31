import { describe, expect, it } from "vitest";

import {
  consumeCliAuthAfterSignIn,
  rememberCliAuthAfterSignIn,
} from "./cli-auto-authorize";

const origin = "https://www.rodge-mail.local";
const requestId = "a".repeat(43);
const callbackUrl = "http://127.0.0.1:43123/auth/desktop-complete";

describe("CLI authorization after browser sign-in", () => {
  it("consumes the matching short-lived CLI request", () => {
    const storage = createStorage();
    const redirectUri = `/desktop-auth?request_id=${requestId}&callback_url=${encodeURIComponent(callbackUrl)}`;

    expect(
      rememberCliAuthAfterSignIn({
        now: 1_000,
        origin,
        redirectUri,
        storage,
      }),
    ).toBe(true);
    expect(
      consumeCliAuthAfterSignIn({
        now: 2_000,
        requestId,
        storage,
      }),
    ).toBe(true);
    expect(
      consumeCliAuthAfterSignIn({
        now: 2_000,
        requestId,
        storage,
      }),
    ).toBe(false);
  });

  it("rejects expired and mismatched requests", () => {
    const storage = createStorage();
    const redirectUri = `/desktop-auth?request_id=${requestId}&callback_url=${encodeURIComponent(callbackUrl)}`;
    rememberCliAuthAfterSignIn({
      now: 1_000,
      origin,
      redirectUri,
      storage,
    });

    expect(
      consumeCliAuthAfterSignIn({
        now: 5 * 60 * 1000 + 1_001,
        requestId,
        storage,
      }),
    ).toBe(false);

    rememberCliAuthAfterSignIn({
      now: 1_000,
      origin,
      redirectUri,
      storage,
    });
    expect(
      consumeCliAuthAfterSignIn({
        now: 2_000,
        requestId: "b".repeat(43),
        storage,
      }),
    ).toBe(false);
  });

  it("does not mark unrelated or malformed redirects", () => {
    const storage = createStorage();

    for (const redirectUri of [
      "/",
      `https://example.com/desktop-auth?request_id=${requestId}`,
      `/desktop-auth?request_id=${requestId}`,
      `/desktop-auth?request_id=${requestId}&callback_url=${encodeURIComponent(callbackUrl)}&unexpected=true`,
      "/desktop-auth?request_id=invalid",
    ]) {
      expect(
        rememberCliAuthAfterSignIn({
          origin,
          redirectUri,
          storage,
        }),
      ).toBe(false);
    }
  });
});

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}
