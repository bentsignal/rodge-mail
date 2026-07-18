import { describe, expect, it } from "vitest";

import type { MailThread } from "@rodge-mail/features/mail";

import { filterSpamThreads } from "./spam-mailbox";

const threads = [
  makeThread("invoice", "Questionable invoice", "billing@unknown.example"),
  makeThread("winner", "You are a winner", "prizes@spam.example"),
];

describe("spam mailbox", () => {
  it("searches the loaded quarantine by sender, subject, and preview", () => {
    expect(filterSpamThreads(threads, "invoice").map(({ id }) => id)).toEqual([
      "invoice",
    ]);
    expect(
      filterSpamThreads(threads, "spam.example").map(({ id }) => id),
    ).toEqual(["winner"]);
    expect(
      filterSpamThreads(threads, "review this").map(({ id }) => id),
    ).toEqual(["invoice", "winner"]);
  });

  it("retains the source array when search is empty", () => {
    expect(filterSpamThreads(threads, "  ")).toBe(threads);
  });
});

function makeThread(id: string, subject: string, address: string) {
  return {
    accountId: "account",
    id,
    isPinned: false,
    isRead: false,
    messages: [],
    preview: "Review this message carefully",
    receivedAt: "2026-07-13T00:00:00.000Z",
    sender: { address, name: address.split("@")[0] ?? address },
    subject,
  } satisfies MailThread;
}
