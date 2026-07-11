import { describe, expect, it } from "vitest";

import {
  isNotificationDeliveryFresh,
  shouldNotifyForProviderMessage,
} from "./policy";

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

  it("does not notify for manual or reconciliation syncs", () => {
    for (const reason of ["manual", "reconcile"]) {
      expect(
        shouldNotifyForProviderMessage({
          fullSync: false,
          now,
          reason,
          receivedAt: now,
        }),
      ).toBe(false);
    }
  });

  it("does not notify for implausibly future-dated mail", () => {
    expect(
      shouldNotifyForProviderMessage({
        fullSync: false,
        now,
        reason: "incremental",
        receivedAt: now + 6 * 60 * 1000,
      }),
    ).toBe(false);
  });
});

describe("classification notification delivery freshness", () => {
  it("allows a fresh delivery for a fresh message", () => {
    expect(
      isNotificationDeliveryFresh({
        deliveryCreatedAt: now - 30_000,
        messageReceivedAt: now - 60_000,
        now,
      }),
    ).toBe(true);
  });

  it("rejects delayed historical deliveries and messages", () => {
    expect(
      isNotificationDeliveryFresh({
        deliveryCreatedAt: now - 25 * 60 * 60 * 1000,
        messageReceivedAt: now,
        now,
      }),
    ).toBe(false);
    expect(
      isNotificationDeliveryFresh({
        deliveryCreatedAt: now,
        messageReceivedAt: now - 25 * 60 * 60 * 1000,
        now,
      }),
    ).toBe(false);
  });

  it("rejects implausibly future-dated deliveries", () => {
    expect(
      isNotificationDeliveryFresh({
        deliveryCreatedAt: now + 6 * 60 * 1000,
        messageReceivedAt: now,
        now,
      }),
    ).toBe(false);
  });
});
