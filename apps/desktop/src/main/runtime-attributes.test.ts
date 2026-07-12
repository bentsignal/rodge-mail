import assert from "node:assert/strict";
import test from "node:test";

import { getDesktopRuntimeAttributes } from "../shared/runtime-attributes.ts";

void test("exposes the platform for macOS-only web shell geometry", () => {
  assert.deepEqual(getDesktopRuntimeAttributes("darwin"), {
    desktopPlatform: "darwin",
    desktopRuntime: "true",
  });
});

void test("identifies non-macOS desktop runtimes without applying mac chrome", () => {
  assert.deepEqual(getDesktopRuntimeAttributes("win32"), {
    desktopPlatform: "win32",
    desktopRuntime: "true",
  });
});
