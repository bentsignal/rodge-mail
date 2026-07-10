import assert from "node:assert/strict";
import test from "node:test";

import {
  isRedirectStatus,
  rewriteEmbeddedRedirect,
} from "./embedded-web-redirects.ts";

const localOrigin = "http://127.0.0.1:43123";
const webAppUrl = new URL("https://rodge-mail.local");

void test("rewrites relative redirects onto the trusted desktop origin", () => {
  assert.equal(
    rewriteEmbeddedRedirect(
      "/login?redirect_uri=%2F#owner",
      localOrigin,
      webAppUrl,
    ),
    "https://rodge-mail.local/login?redirect_uri=%2F#owner",
  );
});

void test("rewrites absolute embedded-runtime redirects", () => {
  assert.equal(
    rewriteEmbeddedRedirect(
      `${localOrigin}/inbox?page=2`,
      localOrigin,
      webAppUrl,
    ),
    "https://rodge-mail.local/inbox?page=2",
  );
});

void test("preserves redirects already targeting the trusted origin", () => {
  assert.equal(
    rewriteEmbeddedRedirect(
      "https://rodge-mail.local/settings/accounts",
      localOrigin,
      webAppUrl,
    ),
    "https://rodge-mail.local/settings/accounts",
  );
});

void test("rejects cross-origin and credential-bearing redirects", () => {
  assert.equal(
    rewriteEmbeddedRedirect(
      "https://attacker.example/mail",
      localOrigin,
      webAppUrl,
    ),
    null,
  );
  assert.equal(
    rewriteEmbeddedRedirect("//attacker.example/mail", localOrigin, webAppUrl),
    null,
  );
  assert.equal(
    rewriteEmbeddedRedirect(
      "https://owner:secret@rodge-mail.local/mail",
      localOrigin,
      webAppUrl,
    ),
    null,
  );
});

void test("recognizes only fetch redirect response statuses", () => {
  for (const status of [301, 302, 303, 307, 308]) {
    assert.equal(isRedirectStatus(status), true);
  }
  for (const status of [200, 204, 300, 304, 305, 306, 400]) {
    assert.equal(isRedirectStatus(status), false);
  }
});
