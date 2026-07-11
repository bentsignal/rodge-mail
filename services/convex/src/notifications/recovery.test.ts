import { describe, expect, it } from "vitest";

import { resolveStaleSendingDelivery } from "./recovery";

describe("stale notification delivery recovery", () => {
  it("finalizes an unknown send without retrying it", () => {
    expect(resolveStaleSendingDelivery([])).toEqual({
      patch: {
        status: "failed",
        acceptedCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        failureKind: "transient",
        error:
          "Push outcome unknown after an interrupted Expo request; not retried to avoid a duplicate notification.",
      },
      shouldCheckReceipts: false,
    });
  });

  it("restores persisted tickets and resumes their receipt checks", () => {
    expect(
      resolveStaleSendingDelivery([
        { status: "pending", expoTicketId: "ticket-1" },
        {
          status: "failed",
          errorCode: "DeviceNotRegistered",
          failureKind: "permanent",
        },
      ]),
    ).toMatchObject({
      patch: {
        status: "partial",
        acceptedCount: 1,
        deliveredCount: 0,
        failedCount: 1,
      },
      shouldCheckReceipts: true,
    });
  });
});
