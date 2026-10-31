import { describe, expect, it } from "vitest";

import { bulkMailbox, MAX_BULK_THREADS } from "./devSeedBulk";

describe("bulkMailbox", () => {
  const now = Date.UTC(2026, 9, 31);

  it("makes one thread per message, older than the regular seed", () => {
    const messages = bulkMailbox(now, 90);
    expect(messages).toHaveLength(90);
    expect(new Set(messages.map((m) => m.remoteThreadId)).size).toBe(90);
    expect(new Set(messages.map((m) => m.remoteMessageId)).size).toBe(90);
    for (const message of messages) {
      expect(message.receivedAt).toBeLessThan(now - 190 * 60 * 60 * 1000);
      expect(message.from.address).toMatch(/(\.example|@example\.(com|net|org))$/);
      expect(message.placement).toBeUndefined();
    }
  });

  it("orders threads newest first", () => {
    const times = bulkMailbox(now, 10).map((m) => m.receivedAt);
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("clamps the count", () => {
    expect(bulkMailbox(now, -3)).toHaveLength(0);
    expect(bulkMailbox(now, 10_000)).toHaveLength(MAX_BULK_THREADS);
  });
});
