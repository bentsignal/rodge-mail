import { describe, expect, it } from "vitest";

import type { AgentSearchHit } from "@rodge-mail/agent-contract";

import { mergeSearchHits } from "./search";

function hit(
  id: string,
  matchKind: AgentSearchHit["matchKind"],
  score?: number,
) {
  return {
    messageId: id,
    threadId: `thread-${id}`,
    accountId: "account",
    accountAddress: "owner@example.com",
    direction: "incoming" as const,
    from: { address: "sender@example.com" },
    to: [{ address: "owner@example.com" }],
    subject: id,
    snippet: id,
    receivedAt: 1,
    isRead: false,
    isPinned: false,
    hasAttachments: false,
    matchKind,
    score,
  } satisfies AgentSearchHit;
}

describe("agent search merging", () => {
  it("deduplicates matches and marks overlap as both", () => {
    expect(
      mergeSearchHits(
        [hit("one", "lexical"), hit("two", "lexical")],
        [hit("two", "semantic", 0.9), hit("three", "semantic", 0.8)],
        3,
      ),
    ).toEqual([
      hit("one", "lexical"),
      hit("two", "both", 0.9),
      hit("three", "semantic", 0.8),
    ]);
  });

  it("applies the caller limit after merging", () => {
    expect(
      mergeSearchHits(
        [hit("one", "lexical")],
        [hit("two", "semantic"), hit("three", "semantic")],
        2,
      ),
    ).toHaveLength(2);
  });
});
