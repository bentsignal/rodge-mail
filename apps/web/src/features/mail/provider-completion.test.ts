import { describe, expect, it } from "vitest";

import {
  createProviderCompletionDeepLink,
  providerCompletionSearchSchema,
} from "./provider-completion";

describe("provider completion contract", () => {
  it.each([
    { gmail: "connected", provider: "gmail" },
    { gmail: "error", provider: "gmail" },
    { microsoft: "connected", provider: "microsoft" },
    { microsoft: "error", provider: "microsoft" },
  ] as const)("accepts a matching provider result: %o", (search) => {
    expect(providerCompletionSearchSchema.safeParse(search).success).toBe(true);
  });

  it.each([
    { provider: "gmail" },
    { microsoft: "connected", provider: "gmail" },
    { gmail: "connected", provider: "microsoft" },
    { gmail: "connected", provider: "icloud" },
    { gmail: "pending", provider: "gmail" },
  ])("rejects a missing or mismatched provider result: %o", (search) => {
    expect(providerCompletionSearchSchema.safeParse(search).success).toBe(
      false,
    );
  });

  it("creates a canonical Gmail return link", () => {
    expect(
      createProviderCompletionDeepLink({
        gmail: "connected",
        provider: "gmail",
      }),
    ).toBe("rodge-mail://provider-complete?provider=gmail&result=connected");
  });

  it("creates a canonical Microsoft error return link", () => {
    expect(
      createProviderCompletionDeepLink({
        microsoft: "error",
        provider: "microsoft",
      }),
    ).toBe("rodge-mail://provider-complete?provider=microsoft&result=error");
  });
});
