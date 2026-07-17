import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDesktopAuthMode,
} from "@rodge-mail/config/desktop";

const electronUserAgent =
  "Mozilla/5.0 AppleWebKit/537.36 Electron/43.1.0 Safari/537.36";
void test("uses direct passkeys only in normal browsers", () => {
  assert.equal(
    resolveDesktopAuthMode({
      userAgent: "Mozilla/5.0 Safari/537.36",
    }),
    "direct-passkey",
  );
});

void test("always hands Electron authentication to the system browser", () => {
  assert.equal(
    resolveDesktopAuthMode({
      userAgent: electronUserAgent,
    }),
    "browser-handoff",
  );
  assert.equal(
    resolveDesktopAuthMode({
      userAgent: `${electronUserAgent} RodgeMailDesktop/packaged`,
    }),
    "browser-handoff",
  );
});
