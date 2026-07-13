import { describe, expect, it } from "vitest";

import {
  shouldAutoGenerateCleanView,
  shouldRequestAutomaticCleanView,
} from "./policy";

describe("automatic clean view policy", () => {
  it("generates only for newly requested non-spam model classifications", () => {
    expect(
      shouldAutoGenerateCleanView({
        requested: true,
        isSpam: false,
        source: "model",
      }),
    ).toBe(true);
    expect(
      shouldAutoGenerateCleanView({
        requested: undefined,
        isSpam: false,
        source: "model",
      }),
    ).toBe(false);
    expect(
      shouldAutoGenerateCleanView({
        requested: true,
        isSpam: true,
        source: "model",
      }),
    ).toBe(false);
    expect(
      shouldAutoGenerateCleanView({
        requested: true,
        isSpam: false,
        source: "rules",
      }),
    ).toBe(false);
  });

  it("requests automatic generation only for newly inserted incoming inbox mail", () => {
    expect(
      shouldRequestAutomaticCleanView({
        messageExists: false,
        direction: "incoming",
        inInbox: true,
      }),
    ).toBe(true);
    expect(
      shouldRequestAutomaticCleanView({
        messageExists: true,
        direction: "incoming",
        inInbox: true,
      }),
    ).toBe(false);
    expect(
      shouldRequestAutomaticCleanView({
        messageExists: false,
        direction: "outgoing",
        inInbox: true,
      }),
    ).toBe(false);
  });
});
