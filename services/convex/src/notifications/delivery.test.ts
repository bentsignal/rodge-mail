import { describe, expect, it } from "vitest";

import { resolveReceiptStatus, summarizeDeliveryTickets } from "./delivery";

describe("notification delivery summaries", () => {
  it("keeps accepted Expo tickets distinct from confirmed delivery", () => {
    expect(
      summarizeDeliveryTickets([
        { status: "pending", expoTicketId: "ticket-1" },
      ]),
    ).toEqual({
      status: "accepted",
      acceptedCount: 1,
      deliveredCount: 0,
      failedCount: 0,
      failureKind: undefined,
      error: undefined,
    });
  });

  it("reports partial delivery and groups failures", () => {
    expect(
      summarizeDeliveryTickets([
        { status: "delivered", expoTicketId: "ticket-1" },
        {
          status: "failed",
          errorCode: "DeviceNotRegistered",
          failureKind: "permanent",
        },
        {
          status: "failed",
          errorCode: "DeviceNotRegistered",
          failureKind: "permanent",
        },
      ]),
    ).toMatchObject({
      status: "partial",
      acceptedCount: 1,
      deliveredCount: 1,
      failedCount: 2,
      failureKind: "permanent",
      error: "2 DeviceNotRegistered",
    });
  });

  it("marks an all-failed transient delivery honestly", () => {
    expect(
      summarizeDeliveryTickets([
        {
          status: "failed",
          errorCode: "MessageRateExceeded",
          failureKind: "transient",
        },
      ]),
    ).toMatchObject({
      status: "failed",
      failedCount: 1,
      failureKind: "transient",
    });
  });

  it("bounds missing receipt follow-up to three attempts", () => {
    expect(resolveReceiptStatus("pending", 2)).toBe("pending");
    expect(resolveReceiptStatus("pending", 3)).toBe("failed");
    expect(resolveReceiptStatus("delivered", 3)).toBe("delivered");
  });
});
