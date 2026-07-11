import { describe, expect, it } from "vitest";

import {
  buildNewMailPush,
  isExpoPushToken,
  MOBILE_THREAD_ROUTE,
} from "./payload";

describe("new-mail notification payloads", () => {
  const message = {
    _id: "message-1",
    threadId: "thread-1",
    from: { address: "sarah@example.com", name: "Sarah" },
    snippet: "Can you review this?",
    subject: "Launch plan",
  };

  it("targets the canonical mobile inbox thread route", () => {
    expect(buildNewMailPush(message, true)).toEqual({
      title: "Sarah",
      body: "Launch plan",
      sound: "default",
      data: {
        messageId: "message-1",
        route: MOBILE_THREAD_ROUTE,
        threadId: "thread-1",
      },
    });
  });

  it("supports privacy-preserving previews", () => {
    expect(buildNewMailPush(message, false).body).toBe("New message");
  });

  it("accepts only Expo push token formats", () => {
    expect(isExpoPushToken("ExpoPushToken[abc_123-def]")).toBe(true);
    expect(isExpoPushToken("ExponentPushToken[abc123]")).toBe(true);
    expect(isExpoPushToken("native-apns-token")).toBe(false);
  });
});
