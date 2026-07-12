import { describe, expect, it } from "vitest";

import { sortPinnedMailRows } from "./order";

describe("sortPinnedMailRows", () => {
  it("puts pinned rows first and keeps each group newest-first", () => {
    const rows = [
      { id: "newest", isPinned: false, receivedAt: 40 },
      { id: "old-pinned", isPinned: true, receivedAt: 10 },
      { id: "older", isPinned: false, receivedAt: 20 },
      { id: "new-pinned", isPinned: true, receivedAt: 30 },
    ];

    expect(sortPinnedMailRows(rows).map((row) => row.id)).toEqual([
      "new-pinned",
      "old-pinned",
      "newest",
      "older",
    ]);
    expect(rows.map((row) => row.id)).toEqual([
      "newest",
      "old-pinned",
      "older",
      "new-pinned",
    ]);
  });

  it("supports ISO timestamps and preserves input order for exact ties", () => {
    const rows = [
      {
        id: "first",
        isPinned: true,
        receivedAt: "2026-07-12T12:00:00.000Z",
      },
      {
        id: "second",
        isPinned: true,
        receivedAt: "2026-07-12T12:00:00.000Z",
      },
    ];

    expect(sortPinnedMailRows(rows).map((row) => row.id)).toEqual([
      "first",
      "second",
    ]);
  });
});
