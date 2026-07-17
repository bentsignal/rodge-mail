import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmbeddedRequestCookieHeader,
  parseEmbeddedCookie,
  readSetCookieHeaders,
  synchronizeEmbeddedResponseCookies,
} from "./embedded-web-cookies.ts";

const webAppUrl = new URL("https://www.rodge-mail.local");

void test("forwards stored cookies to the embedded web runtime", () => {
  assert.equal(
    createEmbeddedRequestCookieHeader([
      { name: "theme", value: "dark" },
      { name: "__Secure-better-auth.session_token", value: "token.signature" },
    ]),
    "theme=dark; __Secure-better-auth.session_token=token.signature",
  );
  assert.equal(createEmbeddedRequestCookieHeader([]), "");
});

void test("parses Better Auth challenge cookies for the trusted app origin", () => {
  assert.deepEqual(
    parseEmbeddedCookie(
      "__Secure-better-auth.better-auth-passkey=token.signature; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax",
      webAppUrl,
      1_000_000,
    ),
    {
      details: {
        expirationDate: 1_300,
        httpOnly: true,
        name: "__Secure-better-auth.better-auth-passkey",
        path: "/",
        sameSite: "lax",
        secure: true,
        url: "https://www.rodge-mail.local",
        value: "token.signature",
      },
      expired: false,
    },
  );
});

void test("marks zero-age cookies for removal", () => {
  const cookie = parseEmbeddedCookie(
    "__Secure-better-auth.session_token=; Max-Age=0; Path=/; Secure",
    webAppUrl,
    1_000_000,
  );

  assert.ok(cookie);
  assert.equal(cookie.expired, true);
  assert.equal(cookie.details.expirationDate, 1_000);
});

void test("lets Max-Age override Expires regardless of attribute order", () => {
  const cookie = parseEmbeddedCookie(
    "challenge=token; Max-Age=300; Expires=Wed, 01 Jan 2020 00:00:00 GMT",
    webAppUrl,
    1_000_000,
  );

  assert.ok(cookie);
  assert.equal(cookie.expired, false);
  assert.equal(cookie.details.expirationDate, 1_300);
});

void test("reads multiple Set-Cookie headers without splitting Expires dates", () => {
  const headers = new Headers();
  headers.append(
    "set-cookie",
    "first=one; Expires=Wed, 15 Jul 2026 00:00:00 GMT; Path=/",
  );
  headers.append("set-cookie", "second=two; Path=/; HttpOnly");

  assert.deepEqual(readSetCookieHeaders(headers), [
    "first=one; Expires=Wed, 15 Jul 2026 00:00:00 GMT; Path=/",
    "second=two; Path=/; HttpOnly",
  ]);
});

void test("synchronizes new and expired cookies with the Electron cookie store", async () => {
  const setCalls = new Array<unknown>();
  const removeCalls = new Array<unknown>();
  const cookieStore = {
    remove(url: string, name: string) {
      removeCalls.push([url, name]);
      return Promise.resolve();
    },
    set(details: unknown) {
      setCalls.push(details);
      return Promise.resolve();
    },
  };
  const headers = new Headers();
  headers.append("set-cookie", "challenge=token; Max-Age=300; Secure");
  headers.append("set-cookie", "session=; Max-Age=0; Secure");

  await synchronizeEmbeddedResponseCookies(cookieStore, webAppUrl, headers);

  assert.equal(setCalls.length, 1);
  assert.partialDeepStrictEqual(setCalls[0], {
    name: "challenge",
    path: "/",
    secure: true,
    url: "https://www.rodge-mail.local",
    value: "token",
  });
  assert.deepEqual(removeCalls, [["https://www.rodge-mail.local", "session"]]);
});
