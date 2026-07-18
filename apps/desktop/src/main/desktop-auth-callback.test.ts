import assert from "node:assert/strict";
import test from "node:test";

import {
  parseDesktopAuthCallback,
  startDesktopAuthCallback,
} from "./desktop-auth-callback.ts";

const requestId = "r".repeat(43);
const authorizationCode = "A_-".repeat(14) + "A";

void test("accepts only the expected GET callback with valid credentials", () => {
  const path = `/auth/desktop-complete?request_id=${requestId}&authorization_code=${authorizationCode}`;

  assert.deepEqual(parseDesktopAuthCallback("GET", path), {
    authorizationCode,
    requestId,
  });
  assert.equal(parseDesktopAuthCallback("POST", path), undefined);
  assert.equal(
    parseDesktopAuthCallback("GET", `${path}&unexpected=true`),
    undefined,
  );
  assert.equal(
    parseDesktopAuthCallback(
      "GET",
      `/auth/desktop-complete?request_id=short&authorization_code=${authorizationCode}`,
    ),
    undefined,
  );
});

void test("listens on loopback and forwards an approved callback", async () => {
  let received: ReturnType<typeof parseDesktopAuthCallback>;
  const runtime = await startDesktopAuthCallback((callback) => {
    received = callback;
  });

  try {
    const callbackUrl = new URL(runtime.url);
    callbackUrl.searchParams.set("request_id", requestId);
    callbackUrl.searchParams.set("authorization_code", authorizationCode);
    const response = await fetch(callbackUrl);

    assert.equal(callbackUrl.hostname, "127.0.0.1");
    assert.equal(response.status, 200);
    assert.deepEqual(received, { authorizationCode, requestId });
    assert.match(await response.text(), /Rodge Mail is open/u);
  } finally {
    await runtime.close();
  }
});
