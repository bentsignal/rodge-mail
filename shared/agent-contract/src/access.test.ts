import { describe, expect, it } from "vitest";

import {
  agentAccountAccessSchema,
  agentCredentialGrantSchema,
  agentScopeSchema,
} from "./access";

describe("agent access grants", () => {
  it.each(["accounts:read", "mail:search", "threads:read"])(
    "accepts the literal %s scope",
    (scope) => {
      expect(agentScopeSchema.parse(scope)).toBe(scope);
    },
  );

  it("rejects write-like and unknown scopes", () => {
    expect(agentScopeSchema.safeParse("mail:send").success).toBe(false);
    expect(agentScopeSchema.safeParse("mail:write").success).toBe(false);
  });

  it("requires an explicit all-accounts or unique allowlist policy", () => {
    expect(agentAccountAccessSchema.parse({ mode: "all" })).toEqual({
      mode: "all",
    });
    expect(
      agentAccountAccessSchema.parse({
        mode: "allowlist",
        accountIds: ["account-a", "account-b"],
      }),
    ).toEqual({
      mode: "allowlist",
      accountIds: ["account-a", "account-b"],
    });
    expect(
      agentAccountAccessSchema.safeParse({
        mode: "allowlist",
        accountIds: ["account-a", "account-a"],
      }).success,
    ).toBe(false);
  });

  it("bounds labels, scopes, expiration, and unknown fields", () => {
    const grant = {
      label: "Local Codex",
      scopes: ["accounts:read", "mail:search", "threads:read"],
      accountAccess: { mode: "all" },
      expiresInDays: 30,
    };
    expect(agentCredentialGrantSchema.safeParse(grant).success).toBe(true);
    expect(
      agentCredentialGrantSchema.safeParse({ ...grant, expiresInDays: 91 })
        .success,
    ).toBe(false);
    expect(
      agentCredentialGrantSchema.safeParse({ ...grant, canSend: true }).success,
    ).toBe(false);
  });
});
