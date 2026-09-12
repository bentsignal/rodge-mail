import { describe, expect, it, vi } from "vitest";

import { checkIdentity } from "./utils";

vi.mock("./convex.env", () => ({
  env: { AUTH_ALLOWED_USER_ID: "owner" },
}));

describe("authenticated backend access", () => {
  const owner = {
    subject: "owner",
    issuer: "https://auth.example.com",
    tokenIdentifier: "https://auth.example.com|owner",
  };

  it("preserves the authenticated owner identity", async () => {
    await expect(
      checkIdentity({
        auth: { getUserIdentity: () => Promise.resolve(owner) },
      }),
    ).resolves.toEqual(owner);
  });

  it("rejects anonymous requests", async () => {
    await expect(
      checkIdentity({ auth: { getUserIdentity: () => Promise.resolve(null) } }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("rejects another signed-in account", async () => {
    await expect(
      checkIdentity({
        auth: {
          getUserIdentity: () =>
            Promise.resolve({ ...owner, subject: "other" }),
        },
      }),
    ).rejects.toThrow("Access denied");
  });
});
