import { describe, expect, it } from "vitest";

import { isAllowedUser, privateAccountHooks } from "./authAccess";

describe("private account access", () => {
  it("only accepts the configured account ID", () => {
    expect(isAllowedUser("owner", "owner")).toBe(true);
    expect(isAllowedUser("other", "owner")).toBe(false);
    expect(isAllowedUser("", "")).toBe(false);
    expect(isAllowedUser("owner", "")).toBe(false);
  });

  it("rejects all new account creation", () => {
    expect(() => privateAccountHooks("owner").user.create.before()).toThrow(
      "Registration is closed",
    );
  });

  it("allows owner sessions and rejects other accounts", async () => {
    const before = privateAccountHooks("owner").session.create.before;
    const session = {
      id: "session",
      userId: "owner",
      token: "test-token",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };
    await expect(before(session)).resolves.toEqual({ data: session });
    expect(() => before({ ...session, userId: "other" })).toThrow(
      "Access denied",
    );
    expect(() =>
      privateAccountHooks("").session.create.before(session),
    ).toThrow("Access denied");
  });
});
