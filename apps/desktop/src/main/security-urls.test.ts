import assert from "node:assert/strict";
import test from "node:test";

import { isDesktopBrowserAuthUrl } from "./browser-auth-url.ts";

const webAppUrl = new URL("https://rodge-mail.local");

void test("recognizes only the dedicated browser authentication route", () => {
  assert.equal(
    isDesktopBrowserAuthUrl(
      "https://rodge-mail.local/desktop-auth?request_id=abc",
      webAppUrl,
    ),
    true,
  );
  assert.equal(
    isDesktopBrowserAuthUrl(
      "https://rodge-mail.local/desktop-auth/complete",
      webAppUrl,
    ),
    false,
  );
  assert.equal(
    isDesktopBrowserAuthUrl("https://attacker.example/desktop-auth", webAppUrl),
    false,
  );
  assert.equal(
    isDesktopBrowserAuthUrl(
      "https://user:secret@rodge-mail.local/desktop-auth",
      webAppUrl,
    ),
    false,
  );
});
