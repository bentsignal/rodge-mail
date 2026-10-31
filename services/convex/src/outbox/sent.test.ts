import { describe, expect, it } from "vitest";

import {
  canOpenStoredMessage,
  getAccountLabel,
  getSentAttachmentCount,
  SENT_SNIPPET_LENGTH,
  toSentAttachments,
  toSentSnippet,
} from "./sent";

describe("sent mail projection", () => {
  it("collapses whitespace and shortens long bodies", () => {
    expect(toSentSnippet("Hi Maya,\n\n  Thursday works.\n")).toBe(
      "Hi Maya, Thursday works.",
    );
    const snippet = toSentSnippet("word ".repeat(100));
    expect(snippet.length).toBeLessThanOrEqual(SENT_SNIPPET_LENGTH);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("keeps attachment summaries after the uploads are deleted", () => {
    expect(
      toSentAttachments([
        {
          contentType: "application/pdf",
          declaredSize: 2048,
          fileName: "plan.pdf",
          size: 2000,
        },
        { contentType: "image/png", declaredSize: 512, fileName: "a.png" },
      ]),
    ).toEqual([
      { contentType: "application/pdf", fileName: "plan.pdf", size: 2000 },
      { contentType: "image/png", fileName: "a.png", size: 512 },
    ]);
  });

  it("counts sent attachments before queued ones", () => {
    expect(getSentAttachmentCount({})).toBe(0);
    expect(
      getSentAttachmentCount({
        sentAttachments: [
          { contentType: "text/plain", fileName: "a", size: 1 },
        ],
      }),
    ).toBe(1);
  });

  it("labels an account by its label, then name, then address", () => {
    expect(getAccountLabel({ address: "a@example.com" })).toBe("a@example.com");
    expect(
      getAccountLabel({ address: "a@example.com", displayName: "Alex" }),
    ).toBe("Alex");
    expect(
      getAccountLabel({
        address: "a@example.com",
        displayLabel: "Work",
        displayName: "Alex",
      }),
    ).toBe("Work");
  });

  it("opens only the owner's visible copy of delivered mail", () => {
    const sent = { ownerId: "owner", status: "sent" } as const;
    expect(canOpenStoredMessage(sent, { ownerId: "owner" })).toBe(true);
    expect(canOpenStoredMessage(sent, { ownerId: "other" })).toBe(false);
    expect(canOpenStoredMessage(sent, { hiddenAt: 1, ownerId: "owner" })).toBe(
      false,
    );
    expect(
      canOpenStoredMessage(
        { ownerId: "owner", status: "failed" },
        { ownerId: "owner" },
      ),
    ).toBe(false);
    expect(canOpenStoredMessage(sent, null)).toBe(false);
  });
});
