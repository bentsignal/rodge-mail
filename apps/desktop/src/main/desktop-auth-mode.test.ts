import assert from "node:assert/strict";
import test from "node:test";

import {
  addPackagedDesktopRuntimeUserAgent,
  isPackagedDesktopRuntimeUserAgent,
  PACKAGED_DESKTOP_USER_AGENT_TOKEN,
  resolveDesktopAuthMode,
} from "@rodge-mail/config/desktop";

const electronUserAgent =
  "Mozilla/5.0 AppleWebKit/537.36 Electron/43.1.0 Safari/537.36";
const embeddedOrigin = "https://www.rodge-mail.local";

void test("uses direct passkeys for normal web and packaged desktop without a hosted auth origin", () => {
  assert.equal(
    resolveDesktopAuthMode({
      currentOrigin: embeddedOrigin,
      userAgent: "Mozilla/5.0 Safari/537.36",
    }),
    "direct-passkey",
  );

  const packagedUserAgent =
    addPackagedDesktopRuntimeUserAgent(electronUserAgent);
  assert.equal(
    resolveDesktopAuthMode({
      currentOrigin: embeddedOrigin,
      userAgent: packagedUserAgent,
    }),
    "direct-passkey",
  );
  assert.equal(
    resolveDesktopAuthMode({
      browserAuthUrl: embeddedOrigin,
      currentOrigin: embeddedOrigin,
      userAgent: packagedUserAgent,
    }),
    "direct-passkey",
  );
});

void test("keeps browser handoff for desktop development and a packaged hosted auth origin", () => {
  assert.equal(
    resolveDesktopAuthMode({
      currentOrigin: embeddedOrigin,
      userAgent: electronUserAgent,
    }),
    "browser-handoff",
  );
  assert.equal(
    resolveDesktopAuthMode({
      browserAuthUrl: "https://auth.rodge-mail.example",
      currentOrigin: embeddedOrigin,
      userAgent: addPackagedDesktopRuntimeUserAgent(electronUserAgent),
    }),
    "browser-handoff",
  );
});

void test("adds an idempotent packaged-only desktop runtime signal", () => {
  const first = addPackagedDesktopRuntimeUserAgent(electronUserAgent);
  const second = addPackagedDesktopRuntimeUserAgent(first);

  assert.equal(first, second);
  assert.ok(first.endsWith(PACKAGED_DESKTOP_USER_AGENT_TOKEN));
  assert.equal(isPackagedDesktopRuntimeUserAgent(first), true);
  assert.equal(isPackagedDesktopRuntimeUserAgent(electronUserAgent), false);
  assert.equal(
    isPackagedDesktopRuntimeUserAgent(PACKAGED_DESKTOP_USER_AGENT_TOKEN),
    false,
  );
});
