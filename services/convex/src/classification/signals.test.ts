import { describe, expect, it } from "vitest";

import { embeddingText, normalizeMail, stableHash } from "./normalize";
import { deriveSignals, deterministicClassification } from "./signals";

const baseMessage = {
  direction: "incoming" as const,
  from: { address: "person@example.com", name: "Person" },
  to: [{ address: "owner@example.com" }],
  cc: [],
  subject: "Hello",
  snippet: "Checking in",
  headers: [],
  hasAttachments: false,
  isPinned: false,
};

describe("mail normalization", () => {
  it("bounds untrusted content and retains only classification headers", () => {
    const mail = normalizeMail(
      {
        ...baseMessage,
        subject: `Ａ\u0000${"x".repeat(700)}`,
        to: Array.from({ length: 30 }, (_, index) => ({
          address: `USER${index}@EXAMPLE.COM`,
        })),
        headers: [
          { name: "List-ID", value: "updates.example.com" },
          { name: "Authentication-Results", value: "sensitive detail" },
        ],
      },
      { plainText: "body\u0007 text", truncated: false },
    );

    expect(mail.subject.startsWith("A")).toBe(true);
    expect(mail.subject).toHaveLength(500);
    expect(mail.to).toHaveLength(20);
    expect(mail.to[0]?.address).toBe("user0@example.com");
    expect(mail.headers).toEqual([
      { name: "list-id", value: "updates.example.com" },
    ]);
    expect(mail.body).toBe("body text");
  });

  it("produces stable bounded embedding input", () => {
    const mail = normalizeMail(baseMessage, {
      plainText: "z".repeat(20_000),
      truncated: true,
    });
    const first = embeddingText(mail);
    const second = embeddingText(mail);

    expect(first.length).toBeLessThanOrEqual(14_000);
    expect(first).toContain("From: Person <person@example.com>");
    expect(stableHash(first)).toBe(stableHash(second));
    expect(stableHash(`${first}!`)).not.toBe(stableHash(first));
  });
});

describe("deterministic focused inbox", () => {
  it("focuses concrete action requests with an explanation", () => {
    const mail = normalizeMail(
      {
        ...baseMessage,
        subject: "Approval required by Friday",
        snippet: "Please review and respond before the deadline.",
      },
      null,
    );
    const result = deterministicClassification(mail, deriveSignals(mail));

    expect(result.bucket).toBe("focused");
    expect(result.category).toBe("action_required");
    expect(result.reason).toContain("concrete request or deadline");
    expect(result.importance).toBeGreaterThan(0.7);
  });

  it("keeps bulk newsletters out of Focused", () => {
    const mail = normalizeMail(
      {
        ...baseMessage,
        from: { address: "newsletter@example.com" },
        headers: [
          { name: "List-Unsubscribe", value: "<mailto:leave@example.com>" },
          { name: "Precedence", value: "bulk" },
        ],
        hasAttachments: true,
      },
      null,
    );
    const result = deterministicClassification(mail, deriveSignals(mail));

    expect(result.bucket).toBe("other");
    expect(result.category).toBe("newsletter");
    expect(result.importance).toBeLessThan(0.25);
  });
});
