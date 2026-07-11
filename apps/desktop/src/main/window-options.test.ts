import assert from "node:assert/strict";
import test from "node:test";

import { getPlatformWindowOptions } from "./window-options.ts";

void test("integrates the web shell into the macOS title bar", () => {
  assert.deepEqual(getPlatformWindowOptions("darwin"), {
    titleBarOverlay: true,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 16 },
  });
});

void test("keeps native window chrome on other platforms", () => {
  assert.deepEqual(getPlatformWindowOptions("win32"), {});
});
