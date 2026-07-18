import { describe, expect, it } from "vitest";

import {
  getAccountReconnectMessage,
  getMobileProviderReturnPath,
  getProviderConnectionMessage,
  getProviderConnectionResult,
} from "./provider-connection";

describe("mobile provider connection", () => {
  it("creates a provider-specific trusted web return path", () => {
    expect(getMobileProviderReturnPath("gmail")).toBe(
      "/provider-complete?provider=gmail",
    );
    expect(getMobileProviderReturnPath("microsoft")).toBe(
      "/provider-complete?provider=microsoft",
    );
  });

  it("accepts only the matching successful deep-link result", () => {
    expect(
      getProviderConnectionResult(
        "gmail",
        "rodge-mail://provider-complete?provider=gmail&result=connected",
      ),
    ).toBe("connected");
    expect(
      getProviderConnectionResult(
        "gmail",
        "rodge-mail://provider-complete?provider=microsoft&result=connected",
      ),
    ).toBe("error");
    expect(
      getProviderConnectionResult(
        "gmail",
        "rodge-mail://provider-complete?provider=gmail&result=error",
      ),
    ).toBe("error");
    expect(getProviderConnectionResult("gmail", undefined)).toBe("cancelled");
  });

  it("does not show an error when the user cancels", () => {
    expect(getProviderConnectionMessage("gmail", "cancelled")).toBeUndefined();
    expect(getProviderConnectionMessage("microsoft", "connected")).toBe(
      "Microsoft 365 connected. Initial sync is running.",
    );
  });

  it("names the account after a reconnect attempt", () => {
    expect(getAccountReconnectMessage("person@gmail.com", "connected")).toBe(
      "person@gmail.com reconnected. Mail sync is running.",
    );
    expect(getAccountReconnectMessage("person@gmail.com", "error")).toBe(
      "Could not reconnect person@gmail.com. Try again.",
    );
    expect(
      getAccountReconnectMessage("person@gmail.com", "cancelled"),
    ).toBeUndefined();
  });
});
