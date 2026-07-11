import { describe, expect, it } from "vitest";

import {
  createNotificationResponseResolver,
  getNotificationTarget,
  MOBILE_THREAD_ROUTE,
} from "./notification-routing";

describe("notification routing", () => {
  const payload = {
    messageId: "message-1",
    route: MOBILE_THREAD_ROUTE,
    threadId: "thread-1",
  };

  it("accepts only complete mail-thread payloads", () => {
    expect(getNotificationTarget(payload)).toEqual({
      messageId: "message-1",
      threadId: "thread-1",
    });
    expect(getNotificationTarget({ ...payload, route: "/settings" })).toBe(
      undefined,
    );
    expect(getNotificationTarget({ ...payload, messageId: undefined })).toBe(
      undefined,
    );
  });

  it("consumes the same native response only once", () => {
    const resolveResponse = createNotificationResponseResolver();
    expect(resolveResponse("response-1", payload)).toBeDefined();
    expect(resolveResponse("response-1", payload)).toBeUndefined();
    expect(resolveResponse("response-2", payload)).toBeDefined();
  });
});
