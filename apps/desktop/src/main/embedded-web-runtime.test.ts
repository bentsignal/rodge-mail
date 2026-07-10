import assert from "node:assert/strict";
import test from "node:test";

import {
  EMBEDDED_WEB_READY_MESSAGE,
  readEmbeddedWebReadyPort,
} from "./embedded-web-runtime.ts";

void test("accepts a valid embedded runtime ready message", () => {
  assert.equal(
    readEmbeddedWebReadyPort({
      port: 49_123,
      type: EMBEDDED_WEB_READY_MESSAGE,
    }),
    49_123,
  );
});

void test("rejects invalid embedded runtime ready messages", () => {
  assert.equal(readEmbeddedWebReadyPort(null), undefined);
  assert.equal(readEmbeddedWebReadyPort({ port: 49_123 }), undefined);
  assert.equal(
    readEmbeddedWebReadyPort({
      port: "49123",
      type: EMBEDDED_WEB_READY_MESSAGE,
    }),
    undefined,
  );
  assert.equal(
    readEmbeddedWebReadyPort({
      port: 0,
      type: EMBEDDED_WEB_READY_MESSAGE,
    }),
    undefined,
  );
});
