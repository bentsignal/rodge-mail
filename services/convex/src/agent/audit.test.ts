import { describe, expect, it } from "vitest";

import { createAuditValues, resultCount } from "./audit";

describe("agent audit projection", () => {
  it("retains only bounded metadata and never copies request content", () => {
    const values = createAuditValues({
      argsHash: "hash",
      createdAt: 123,
      credentialFingerprint: "fingerprint",
      durationMs: 9.9,
      outcome: "succeeded",
      requestId: "request",
      resultCount: 2,
      tool: "search_mail",
    });

    expect(values).toEqual({
      argsHash: "hash",
      createdAt: 123,
      credentialFingerprint: "fingerprint",
      durationMs: 9,
      errorCode: undefined,
      outcome: "succeeded",
      requestId: "request",
      resultCount: 2,
      tool: "search_mail",
    });
    expect(values).not.toHaveProperty("arguments");
    expect(values).not.toHaveProperty("body");
    expect(values).not.toHaveProperty("token");
  });

  it("counts only known response collections", () => {
    expect(resultCount({ accounts: [{}, {}] })).toBe(2);
    expect(resultCount({ messages: [{}] })).toBe(1);
    expect(resultCount({ thread: { messages: [{}, {}, {}] } })).toBe(3);
    expect(resultCount({ arbitrary: [] })).toBeUndefined();
  });
});
