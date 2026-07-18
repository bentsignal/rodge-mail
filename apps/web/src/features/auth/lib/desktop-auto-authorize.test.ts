import { describe, expect, it } from "vitest";

import {
  consumeDesktopAuthAfterSignIn,
  rememberDesktopAuthAfterSignIn,
} from "./desktop-auto-authorize";

const origin = "https://www.rodge-mail.local";
const requestId = "a".repeat(43);
const callbackUrl = "http://127.0.0.1:43123/auth/desktop-complete";

describe("desktop authorization after browser sign-in", () => {
  it("consumes the matching short-lived desktop request", () => {
    const storage = createStorage();
    const redirectUri = `/desktop-auth?request_id=${requestId}&callback_url=${encodeURIComponent(callbackUrl)}`;

    expect(
      rememberDesktopAuthAfterSignIn({
        now: 1_000,
        origin,
        redirectUri,
        storage,
      }),
    ).toBe(true);
    expect(
      consumeDesktopAuthAfterSignIn({
        now: 2_000,
        requestId,
        storage,
      }),
    ).toBe(true);
    expect(
      consumeDesktopAuthAfterSignIn({
        now: 2_000,
        requestId,
        storage,
      }),
    ).toBe(false);
  });

  it("rejects expired and mismatched requests", () => {
    const storage = createStorage();
    const redirectUri = `/desktop-auth?request_id=${requestId}`;
    rememberDesktopAuthAfterSignIn({
      now: 1_000,
      origin,
      redirectUri,
      storage,
    });

    expect(
      consumeDesktopAuthAfterSignIn({
        now: 5 * 60 * 1000 + 1_001,
        requestId,
        storage,
      }),
    ).toBe(false);

    rememberDesktopAuthAfterSignIn({
      now: 1_000,
      origin,
      redirectUri,
      storage,
    });
    expect(
      consumeDesktopAuthAfterSignIn({
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
      `/desktop-auth?request_id=${requestId}&unexpected=true`,
      "/desktop-auth?request_id=invalid",
    ]) {
      expect(
        rememberDesktopAuthAfterSignIn({
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
