import { describe, expect, it } from "vitest";

import type { MailThread } from "@rodge-mail/features/mail";

import { stableRows } from "./stable-rows";

function thread(id: string, isRead: boolean) {
  return {
    accountId: "account",
    id,
    isPinned: false,
    isRead,
    messages: [],
    preview: "",
    receivedAt: "2026-10-31T00:00:00.000Z",
    sender: { address: "a@example.com", name: "A" },
    subject: "",
  } satisfies MailThread;
}

describe("stableRows", () => {
  it("keeps the object for a row whose content is unchanged", () => {
    const [first] = stableRows([thread("a", false)]);
    const [second] = stableRows([thread("a", false)]);
    expect(second).toBe(first);
  });

  it("returns the new object when the content changed", () => {
    const [first] = stableRows([thread("b", false)]);
    const [second] = stableRows([thread("b", true)]);
    expect(second).not.toBe(first);
    expect(second?.isRead).toBe(true);
  });
});
