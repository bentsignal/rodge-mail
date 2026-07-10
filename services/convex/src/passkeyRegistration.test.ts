import { describe, expect, it } from "vitest";

import {
  createPasskeyRegistrationContext,
  parsePasskeyRegistrationContext,
} from "@rodge-mail/config/auth";

describe("passkey registration context", () => {
  it("normalizes a registration for transport", () => {
    const context = createPasskeyRegistrationContext({
      email: "  Person@Example.COM ",
      name: "  Pat   Example  ",
    });

    expect(parsePasskeyRegistrationContext(context)).toEqual({
      email: "person@example.com",
      name: "Pat Example",
    });
  });

  it.each([
    undefined,
    null,
    "",
    "not-json",
    JSON.stringify({ email: "missing-at.example.com", name: "Person" }),
    JSON.stringify({ email: "person@example.com", name: "" }),
  ])("rejects invalid registration context", (context) => {
    expect(parsePasskeyRegistrationContext(context)).toBeUndefined();
  });

  it("rejects invalid client input", () => {
    expect(() =>
      createPasskeyRegistrationContext({ email: "invalid", name: "Person" }),
    ).toThrow("Enter a valid name and email address.");
  });
});
