import { describe, expect, it } from "vitest";

import {
  classifyHttpFailure,
  parseExpoPushReceipts,
  parseExpoPushTickets,
  shouldDisableExpoPushToken,
} from "./expo";

describe("Expo push response parsing", () => {
  it("preserves accepted tickets and classifies permanent token failures", () => {
    expect(
      parseExpoPushTickets(
        {
          data: [
            { status: "ok", id: "ticket-1" },
            {
              status: "error",
              message: "Device is no longer registered",
              details: { error: "DeviceNotRegistered" },
            },
          ],
        },
        2,
      ),
    ).toEqual([
      { status: "accepted", ticketId: "ticket-1" },
      {
        status: "failed",
        errorCode: "DeviceNotRegistered",
        error: "Device is no longer registered",
        failureKind: "permanent",
      },
    ]);
  });

  it("classifies rate limits and server failures as transient", () => {
    expect(
      parseExpoPushTickets(
        {
          data: [
            {
              status: "error",
              message: "Slow down",
              details: { error: "MessageRateExceeded" },
            },
          ],
        },
        1,
      )[0],
    ).toMatchObject({ failureKind: "transient" });
    expect(classifyHttpFailure(429)).toBe("transient");
    expect(classifyHttpFailure(503)).toBe("transient");
    expect(classifyHttpFailure(400)).toBe("permanent");
    expect(shouldDisableExpoPushToken("DeviceNotRegistered")).toBe(true);
    expect(shouldDisableExpoPushToken("MessageRateExceeded")).toBe(false);
  });

  it("keeps absent receipts pending and parses delivery outcomes", () => {
    expect(
      parseExpoPushReceipts(
        {
          data: {
            delivered: { status: "ok" },
            rejected: {
              status: "error",
              message: "Unregistered",
              details: { error: "DeviceNotRegistered" },
            },
          },
        },
        ["delivered", "rejected", "not-ready"],
      ),
    ).toEqual([
      { status: "delivered", ticketId: "delivered" },
      {
        status: "failed",
        ticketId: "rejected",
        errorCode: "DeviceNotRegistered",
        error: "Unregistered",
        failureKind: "permanent",
      },
      { status: "pending", ticketId: "not-ready" },
    ]);
  });

  it("rejects mismatched ticket counts", () => {
    expect(() => parseExpoPushTickets({ data: [] }, 1)).toThrow(
      "Expo returned 0 tickets for 1 messages",
    );
  });
});
