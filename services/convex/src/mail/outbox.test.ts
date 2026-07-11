import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import {
  canRetryOutbox,
  getIdempotentEnqueueResult,
  getRetryOutboxUpdate,
  validateRecipientFields,
} from "./outbox";

const outboxId = "outbox-1";
const attachmentId = "attachment-1";
const payload = {
  attachmentIds: [attachmentId],
  bcc: [{ address: "bcc@example.com" }],
  cc: [{ address: "cc@example.com", name: "CC" }],
  plainText: "Body",
  replyToMessageId: undefined,
  subject: "Subject",
  to: [{ address: "to@example.com", name: "To" }],
};

describe("outbox retry safety", () => {
  it.each(["pending", "sending", "sent"] as const)(
    "does not retry a %s delivery",
    (status) => {
      expect(canRetryOutbox({ status })).toBe(false);
    },
  );

  it("allows a failed delivery to be reclaimed", () => {
    expect(canRetryOutbox({ status: "failed" })).toBe(true);
  });

  it("preserves idempotency, attempt, and provider draft fields", () => {
    const update = getRetryOutboxUpdate(1_234);

    expect(update).toEqual({
      error: undefined,
      status: "pending",
      updatedAt: 1_234,
    });
    expect(update).not.toHaveProperty("idempotencyKey");
    expect(update).not.toHaveProperty("attempt");
    expect(update).not.toHaveProperty("remoteMessageId");
  });
});

describe("outbox enqueue idempotency", () => {
  it.each(["pending", "sending", "sent"] as const)(
    "returns the existing %s delivery status for an identical payload",
    (status) => {
      expect(
        getIdempotentEnqueueResult(
          { _id: outboxId, status, ...payload },
          payload,
        ),
      ).toEqual({ outboxId, reused: true, status });
    },
  );

  const payloadChanges = [
    ["recipients", { to: [{ address: "other@example.com" }] }],
    ["subject", { subject: "Changed" }],
    ["body", { plainText: "Changed" }],
    ["reply target", { replyToMessageId: "message-1" }],
    ["attachments", { attachmentIds: [] }],
  ] satisfies readonly [
    string,
    Partial<Parameters<typeof getIdempotentEnqueueResult>[1]>,
  ][];

  it.each(payloadChanges)(
    "rejects reuse with different %s",
    (_label, change) => {
      expect(() =>
        getIdempotentEnqueueResult(
          { _id: outboxId, status: "pending", ...payload },
          { ...payload, ...change },
        ),
      ).toThrow(
        new ConvexError(
          "This send attempt already exists with different message content",
        ),
      );
    },
  );

  it("does not report a failed attempt as successfully queued", () => {
    expect(() =>
      getIdempotentEnqueueResult(
        { _id: outboxId, status: "failed", ...payload },
        payload,
      ),
    ).toThrow(
      new ConvexError("This send attempt failed. Retry it from the outbox."),
    );
  });
});

describe("outbox recipients", () => {
  it("normalizes and deduplicates recipients before persistence", () => {
    expect(
      validateRecipientFields({
        bcc: [
          { address: "OTHER@example.com" },
          { address: "hidden@example.com" },
        ],
        cc: [
          { address: "person@example.com" },
          { address: "other@example.com" },
        ],
        to: [{ address: " PERSON@Example.com ", name: " Person " }],
      }),
    ).toEqual({
      bcc: [{ address: "hidden@example.com" }],
      cc: [{ address: "other@example.com" }],
      to: [{ address: "person@example.com", name: "Person" }],
    });
  });

  it.each([
    ["To", { to: [{ address: "invalid" }] }],
    [
      "CC",
      {
        cc: [{ address: "invalid" }],
        to: [{ address: "to@example.com" }],
      },
    ],
    [
      "BCC",
      {
        bcc: [{ address: "invalid" }],
        to: [{ address: "to@example.com" }],
      },
    ],
  ] as const)("rejects an invalid %s recipient", (field, values) => {
    expect(() => validateRecipientFields(values)).toThrow(
      new ConvexError(`Invalid ${field} recipient: invalid`),
    );
  });

  it("requires a To recipient even when CC is populated", () => {
    expect(() =>
      validateRecipientFields({
        cc: [{ address: "cc@example.com" }],
        to: [],
      }),
    ).toThrow(new ConvexError("At least one valid To recipient is required"));
  });
});
