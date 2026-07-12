import { describe, expect, it, vi } from "vitest";

import { createAuthCallbackHandler } from "./auth-callback";

describe("auth callback", () => {
  it("returns to login without exchanging a missing token", async () => {
    const verifyOneTimeToken = vi.fn();
    const handler = createAuthCallbackHandler({
      copyAuthCookies: vi.fn(),
      verifyOneTimeToken,
    });

    const response = await handler(
      new Request(
        "https://mail.test/auth/callback?redirect_uri=%2Fmessages%2F1",
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://mail.test/login");
    expect(verifyOneTimeToken).not.toHaveBeenCalled();
  });

  it("returns to login when the one-time token is rejected", async () => {
    const verifyOneTimeToken = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));
    const handler = createAuthCallbackHandler({
      copyAuthCookies: vi.fn(),
      verifyOneTimeToken,
    });

    const response = await handler(
      new Request("https://mail.test/auth/callback?ott=expired"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://mail.test/login");
    expect(verifyOneTimeToken).toHaveBeenCalledWith("expired");
  });

  it("copies verified cookies and returns to the requested in-app location", async () => {
    const verificationResponse = new Response(null, { status: 204 });
    const copyAuthCookies = vi.fn((_from: Response, headers: Headers) => {
      headers.append("set-cookie", "session=verified; Secure; HttpOnly");
    });
    const handler = createAuthCallbackHandler({
      copyAuthCookies,
      verifyOneTimeToken: vi.fn().mockResolvedValue(verificationResponse),
    });

    const response = await handler(
      new Request(
        "https://mail.test/auth/callback?ott=fresh&redirect_uri=%2Fmessages%2Fmessage_1%3Fmailbox%3Daccount_1",
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "/messages/message_1?mailbox=account_1",
    );
    expect(response.headers.get("set-cookie")).toContain("session=verified");
    expect(copyAuthCookies).toHaveBeenCalledWith(
      verificationResponse,
      expect.any(Headers),
    );
  });

  it("never redirects a verified session to an external origin", async () => {
    const handler = createAuthCallbackHandler({
      copyAuthCookies: vi.fn(),
      verifyOneTimeToken: vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 204 })),
    });

    const response = await handler(
      new Request(
        "https://mail.test/auth/callback?ott=fresh&redirect_uri=%2F%5C%5Cevil.test%2Fcollect",
      ),
    );

    expect(response.headers.get("location")).toBe("/");
  });
});
