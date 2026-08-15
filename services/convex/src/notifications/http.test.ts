import { describe, expect, it } from "vitest";

import { parseQuickActionRequest } from "./quickAction";

describe("notification quick-action HTTP requests", () => {
  const token = "a".repeat(43);

  it.each(["pin", "mark-read", "archive"] as const)(
    "accepts the %s capability action",
    (action) => {
      expect(
        parseQuickActionRequest({ action, deliveryId: "delivery-1", token }),
      ).toEqual({ action, deliveryId: "delivery-1", token });
    },
  );

  it("rejects unsupported actions and short tokens", () => {
    expect(
      parseQuickActionRequest({
        action: "reply",
        deliveryId: "delivery-1",
        token,
      }),
    ).toBeUndefined();
    expect(
      parseQuickActionRequest({
        action: "pin",
        deliveryId: "delivery-1",
        token: "short",
      }),
    ).toBeUndefined();
  });
});
