import { describe, expect, it, vi } from "vitest";

import {
  getNotificationQuickActionRequest,
  performNotificationQuickAction,
} from "./notification-quick-action";

describe("notification quick action requests", () => {
  const data = {
    quickActionDeliveryId: "delivery-1",
    quickActionToken: "secret-token",
    quickActionUrl: "https://example.convex.site/notifications/quick-action",
  };

  it("accepts a complete secure action capability", () => {
    expect(getNotificationQuickActionRequest("archive", data)).toEqual({
      action: "archive",
      deliveryId: "delivery-1",
      token: "secret-token",
      url: "https://example.convex.site/notifications/quick-action",
    });
  });

  it("rejects incomplete and insecure action capabilities", () => {
    expect(
      getNotificationQuickActionRequest("pin", {
        ...data,
        quickActionUrl: "http://example.com/action",
      }),
    ).toBeUndefined();
    expect(
      getNotificationQuickActionRequest("mark-read", {
        ...data,
        quickActionToken: "",
      }),
    ).toBeUndefined();
  });

  it("posts only the scoped action data", async () => {
    const requestFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );
    const request = getNotificationQuickActionRequest("archive", data);
    if (!request) throw new Error("Expected a valid quick-action request");

    await expect(
      performNotificationQuickAction(request, requestFetch),
    ).resolves.toBe(true);
    expect(requestFetch).toHaveBeenCalledWith(data.quickActionUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "archive",
        deliveryId: "delivery-1",
        token: "secret-token",
      }),
    });
  });
});
