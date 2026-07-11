import { describe, expect, it } from "vitest";

import {
  accountIsAllowed,
  allUnique,
  credentialIsActive,
  filterAllowedAccountIds,
  hasRequiredScope,
  resolveAgentTool,
  validateCredentialLifetime,
} from "./policy";

describe("agent credential policy", () => {
  it("recognizes only the three read-only tools", () => {
    expect(resolveAgentTool("list_accounts")).toBe("list_accounts");
    expect(resolveAgentTool("search_mail")).toBe("search_mail");
    expect(resolveAgentTool("get_thread")).toBe("get_thread");
    expect(resolveAgentTool("send_mail")).toBeUndefined();
    expect(resolveAgentTool("delete_message")).toBeUndefined();
  });

  it("requires the exact scope for each tool", () => {
    expect(hasRequiredScope(["mail:search"], "search_mail")).toBe(true);
    expect(hasRequiredScope(["mail:search"], "get_thread")).toBe(false);
  });

  it("enforces revocation and the exclusive expiry boundary", () => {
    expect(credentialIsActive({ expiresAt: 101 }, 100)).toBe(true);
    expect(credentialIsActive({ expiresAt: 100 }, 100)).toBe(false);
    expect(credentialIsActive({ expiresAt: 101, revokedAt: 99 }, 100)).toBe(
      false,
    );
  });

  it("intersects an allowlist with accounts owned by the principal", () => {
    const access = { mode: "allowlist" as const, accountIds: ["a", "x"] };

    expect(accountIsAllowed(access, "a")).toBe(true);
    expect(accountIsAllowed(access, "b")).toBe(false);
    expect(filterAllowedAccountIds(access, ["a", "b"])).toEqual(["a"]);
  });

  it("bounds lifetimes and rejects duplicate selections", () => {
    expect(validateCredentialLifetime(undefined)).toBe(30);
    expect(validateCredentialLifetime(90)).toBe(90);
    expect(() => validateCredentialLifetime(91)).toThrow();
    expect(allUnique(["a", "b"])).toBe(true);
    expect(allUnique(["a", "a"])).toBe(false);
  });
});
