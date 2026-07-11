import { describe, expect, it } from "vitest";

import { shouldNotifyForProviderMessage } from "./policy";

const now = Date.parse("2026-07-10T12:00:00.000Z");

describe("new-mail notification gating", () => {
  it("never notifies for initial or repair full imports", () => {
    expect(
      shouldNotifyForProviderMessage({
        fullSync: true,
        now,
        reason: "initial",
        receivedAt: now,
      }),
    ).toBe(false);
    expect(
      shouldNotifyForProviderMessage({
        fullSync: true,
        now,
        reason: "incremental",
        receivedAt: now,
      }),
    ).toBe(false);
  });

  it("notifies a freshly arrived incremental message", () => {
    expect(
      shouldNotifyForProviderMessage({
        fullSync: false,
        now,
        reason: "incremental",
        receivedAt: now - 60_000,
      }),
    ).toBe(true);
  });

  it("does not notify for historical messages discovered incrementally", () => {
    expect(
      shouldNotifyForProviderMessage({
        fullSync: false,
        now,
        reason: "incremental",
        receivedAt: now - 25 * 60 * 60 * 1000,
      }),
    ).toBe(false);
  });
});
