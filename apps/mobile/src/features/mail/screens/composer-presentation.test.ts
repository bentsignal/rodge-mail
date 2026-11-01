import { describe, expect, it } from "vitest";

import {
  addRecipientTokens,
  getComposerAccountLabel,
  getRecipientToken,
  joinRecipientTokens,
  splitRecipientTokens,
  takeRecipientTokens,
} from "./composer-presentation";

describe("getComposerAccountLabel", () => {
  it("avoids repeating an address-only label", () => {
    expect(
      getComposerAccountLabel({
        address: "ada@example.com",
        label: "ada@example.com",
      }),
    ).toBe("ada@example.com");
  });

  it("keeps a useful account label and address", () => {
    expect(
      getComposerAccountLabel({
        address: "ada@example.com",
        label: "Work",
      }),
    ).toBe("Work · ada@example.com");
  });
});

describe("recipient tokens", () => {
  it("splits a field into tokens", () => {
    expect(splitRecipientTokens("a@example.com, b@example.com;\n")).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
    expect(splitRecipientTokens("")).toEqual([]);
  });

  it("keeps typing until a separator or a complete address and a space", () => {
    expect(takeRecipientTokens("maya@exa")).toEqual({
      pending: "maya@exa",
      tokens: [],
    });
    expect(takeRecipientTokens("maya@example.com ")).toEqual({
      pending: "",
      tokens: ["maya@example.com"],
    });
    expect(takeRecipientTokens("maya ")).toEqual({
      pending: "maya ",
      tokens: [],
    });
    expect(takeRecipientTokens("a@example.com, b@example.com,")).toEqual({
      pending: "",
      tokens: ["a@example.com", "b@example.com"],
    });
    expect(takeRecipientTokens("a@example.com, b@exa")).toEqual({
      pending: "a@example.com, b@exa",
      tokens: [],
    });
    expect(takeRecipientTokens("Maya Chen ")).toEqual({
      pending: "Maya Chen ",
      tokens: [],
    });
  });

  it("adds tokens once each", () => {
    expect(
      addRecipientTokens(["a@example.com"], ["A@example.com", "b@example.com"]),
    ).toEqual(["a@example.com", "b@example.com"]);
  });

  it("joins tokens and unfinished text into the draft field", () => {
    expect(joinRecipientTokens(["a@example.com"], " b@exa ")).toBe(
      "a@example.com, b@exa",
    );
    expect(joinRecipientTokens([], "")).toBe("");
  });

  it("labels tokens by name and flags invalid ones", () => {
    expect(getRecipientToken("Maya Chen <maya@example.com>")).toEqual({
      label: "Maya Chen",
      valid: true,
    });
    expect(getRecipientToken("maya@example.com")).toEqual({
      label: "maya@example.com",
      valid: true,
    });
    expect(getRecipientToken("maya")).toEqual({ label: "maya", valid: false });
  });
});
