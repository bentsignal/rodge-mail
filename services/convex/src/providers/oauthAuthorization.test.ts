import { describe, expect, it, vi } from "vitest";

import { buildGoogleAuthorizationUrl } from "./gmail/oauth";
import { buildMicrosoftAuthorizationUrl } from "./microsoft/oauth";

vi.mock("./env", () => ({ providerEnv: {} }));
vi.mock("../urls", () => ({
  urls: { convex: { site: "https://example.convex.site" } },
}));

describe("provider OAuth authorization", () => {
  it("hints the Gmail account being reconnected", () => {
    const url = new URL(
      buildGoogleAuthorizationUrl({
        clientId: "google-client",
        clientSecret: "unused",
        codeChallenge: "challenge",
        loginHint: "person@gmail.com",
        redirectUri: "https://example.com/google",
        state: "state",
      }),
    );

    expect(url.searchParams.get("login_hint")).toBe("person@gmail.com");
  });

  it("hints the Microsoft account being reconnected", () => {
    const url = new URL(
      buildMicrosoftAuthorizationUrl({
        clientId: "microsoft-client",
        clientSecret: "unused",
        codeChallenge: "challenge",
        loginHint: "person@outlook.com",
        redirectUri: "https://example.com/microsoft",
        state: "state",
        tenant: "common",
      }),
    );

    expect(url.searchParams.get("login_hint")).toBe("person@outlook.com");
  });

  it("omits login hints for add-account flows", () => {
    const url = new URL(
      buildGoogleAuthorizationUrl({
        clientId: "google-client",
        clientSecret: "unused",
        codeChallenge: "challenge",
        redirectUri: "https://example.com/google",
        state: "state",
      }),
    );

    expect(url.searchParams.has("login_hint")).toBe(false);
  });
});
