import assert from "node:assert/strict";
import test from "node:test";

import {
  findSupportedNodeBinary,
  isSupportedNodeVersion,
} from "./node-runtime.mjs";

test("accepts only the supported Node 22 range", () => {
  assert.equal(isSupportedNodeVersion("22.12.0"), true);
  assert.equal(isSupportedNodeVersion("22.21.1"), true);
  assert.equal(isSupportedNodeVersion("22.11.0"), false);
  assert.equal(isSupportedNodeVersion("24.14.0"), false);
  assert.equal(isSupportedNodeVersion("invalid"), false);
});

test("keeps an already-compatible runtime", () => {
  assert.equal(
    findSupportedNodeBinary({
      currentBinary: "/example/node",
      currentVersion: "22.18.0",
      environment: {},
      homeDirectory: "/does-not-exist",
    }),
    "/example/node",
  );
});
