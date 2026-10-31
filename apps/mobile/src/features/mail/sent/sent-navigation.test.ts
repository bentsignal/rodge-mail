import { describe, expect, it } from "vitest";

import { getSentRowTarget } from "./sent-navigation";

describe("getSentRowTarget", () => {
  it("opens delivered mail in the reader at the sent message", () => {
    expect(
      getSentRowTarget({ _id: "o1", messageId: "m1", threadId: "t1" }),
    ).toBe("/(tabs)/(inbox)/thread/t1?messageId=m1");
  });

  it("opens queued, failed, or unsynced mail from the outbox", () => {
    expect(getSentRowTarget({ _id: "o1" })).toBe("/(tabs)/(inbox)/sent/o1");
  });

  it("waits for the server before opening a just-sent message", () => {
    expect(getSentRowTarget({ _id: "optimistic-key" })).toBeUndefined();
  });
});
