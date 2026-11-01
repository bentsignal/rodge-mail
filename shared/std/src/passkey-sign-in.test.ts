import { describe, expect, it } from "vitest";

import type { PasskeySignIn } from "./passkey-sign-in";
import { getPasskeyRemovalBlock, getPasskeySignIn } from "./passkey-sign-in";

const rpIds = {
  app: "fake-deployment.convex.site",
  website: "mail.example.com",
};

function passkeys(...signsInTo: PasskeySignIn[]) {
  return signsInTo.map((target, index) => ({
    id: `${target}-${index}`,
    signsInTo: target,
  }));
}

describe("getPasskeySignIn", () => {
  it("reads the platform from the relying party", () => {
    expect(getPasskeySignIn(rpIds.app, rpIds)).toBe("app");
    expect(getPasskeySignIn(rpIds.website, rpIds)).toBe("website");
    expect(getPasskeySignIn("old.example.com", rpIds)).toBe("nowhere");
    expect(getPasskeySignIn(undefined, rpIds)).toBe("unknown");
    expect(getPasskeySignIn(null, rpIds)).toBe("unknown");
  });

  it("treats any other known relying party as the website without one", () => {
    expect(getPasskeySignIn("mail.example.com", { app: rpIds.app })).toBe(
      "website",
    );
  });
});

describe("getPasskeyRemovalBlock", () => {
  it("keeps each platform's last passkey", () => {
    const list = passkeys("website", "app", "app");
    expect(getPasskeyRemovalBlock(list, "website-0")).toBe(
      "This is your only passkey for the website.",
    );
    expect(getPasskeyRemovalBlock(list, "app-1")).toBeUndefined();
  });

  it("doesn't count unknown passkeys as a platform's spare", () => {
    const list = passkeys("app", "unknown", "unknown");
    expect(getPasskeyRemovalBlock(list, "app-0")).toBe(
      "This is your only passkey for the iPhone app.",
    );
  });

  it("keeps unknown passkeys until both platforms have a known one", () => {
    expect(
      getPasskeyRemovalBlock(
        passkeys("app", "unknown", "unknown"),
        "unknown-1",
      ),
    ).toBe(
      "This might be your only passkey for the website. Sign in to the website with it once, or add another passkey there first.",
    );
    expect(
      getPasskeyRemovalBlock(
        passkeys("website", "app", "unknown"),
        "unknown-2",
      ),
    ).toBeUndefined();
  });

  it("lets a passkey for neither platform go", () => {
    expect(
      getPasskeyRemovalBlock(passkeys("nowhere"), "nowhere-0"),
    ).toBeUndefined();
  });

  it("ignores an id it doesn't know", () => {
    expect(getPasskeyRemovalBlock(passkeys("app"), "missing")).toBeUndefined();
  });
});
