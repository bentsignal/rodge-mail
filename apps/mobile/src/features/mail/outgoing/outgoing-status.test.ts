import { describe, expect, it } from "vitest";

import { getOutgoingBannerState } from "./outgoing-status";

describe("getOutgoingBannerState", () => {
  const send = { outboxId: "o1", phase: "queued", subject: "Hi" } as const;

  it("shows nothing without a send", () => {
    expect(getOutgoingBannerState(undefined)).toBeUndefined();
  });

  it("is sending while the enqueue or delivery is in flight", () => {
    expect(
      getOutgoingBannerState({ phase: "enqueuing", subject: "Hi" })?.kind,
    ).toBe("sending");
    expect(
      getOutgoingBannerState(send, [{ _id: "o1", status: "pending" }])?.kind,
    ).toBe("sending");
    expect(getOutgoingBannerState(send, [])?.kind).toBe("sending");
  });

  it("follows the outbox to sent or failed", () => {
    expect(
      getOutgoingBannerState(send, [{ _id: "o1", status: "sent" }]),
    ).toEqual({ kind: "sent", message: "Sent", outboxId: "o1" });
    expect(
      getOutgoingBannerState(send, [{ _id: "o1", status: "failed" }]),
    ).toEqual({ kind: "failed", message: "Not sent", outboxId: "o1" });
  });

  it("fails when the enqueue itself fails", () => {
    expect(
      getOutgoingBannerState({ phase: "failed", subject: "Hi" })?.kind,
    ).toBe("failed");
  });
});
