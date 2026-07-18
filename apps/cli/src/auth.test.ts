import { describe, expect, it } from "vitest";

import { parseAuthCallback } from "./auth-callback.ts";
import { extractSessionCookie } from "./auth.ts";
import { browserCommand } from "./browser.ts";

const requestId = "a".repeat(43);
const authorizationCode = "b".repeat(43);

describe("CLI browser authentication", () => {
  it("accepts only the expected loopback callback", () => {
    expect(
      parseAuthCallback(
        "GET",
        `/auth/desktop-complete?authorization_code=${authorizationCode}&request_id=${requestId}`,
        requestId,
      ),
    ).toEqual({ authorizationCode, requestId });
    expect(
      parseAuthCallback(
        "GET",
        `/auth/desktop-complete?authorization_code=${authorizationCode}&request_id=${"c".repeat(43)}`,
        requestId,
      ),
    ).toBeUndefined();
  });

  it("extracts only the Better Auth session cookie", () => {
    const headers = new Headers();
    headers.append("set-cookie", "theme=dark; Path=/");
    headers.append(
      "set-cookie",
      "__Secure-better-auth.session_token=secret.signature; Path=/; Secure; HttpOnly",
    );
    expect(extractSessionCookie(headers)).toBe(
      "__Secure-better-auth.session_token=secret.signature",
    );
  });

  it("opens URLs without a shell on Unix platforms", () => {
    expect(browserCommand("https://mail.test/auth", "darwin")).toEqual({
      executable: "open",
      arguments: ["https://mail.test/auth"],
    });
    expect(browserCommand("https://mail.test/auth", "linux")).toEqual({
      executable: "xdg-open",
      arguments: ["https://mail.test/auth"],
    });
  });
});
