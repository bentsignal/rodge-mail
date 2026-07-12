import { describe, expect, it } from "vitest";

import { toMailAccount } from "./convex-mail";

describe("mobile account presentation", () => {
  it("uses the custom label while retaining account identity", () => {
    const account = toMailAccount({
      _creationTime: 1,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Branded Convex IDs are compile-time-only in this presentation test.
      _id: "account" as never,
      address: "person@example.com",
      createdAt: 1,
      displayLabel: "Family mail",
      displayName: "Personal Gmail",
      ownerId: "owner",
      provider: "gmail",
      remoteAccountId: "remote",
      status: "connected",
      updatedAt: 1,
    });

    expect(account.label).toBe("Family mail");
    expect(account.displayName).toBe("Personal Gmail");
    expect(account.address).toBe("person@example.com");
  });
});
