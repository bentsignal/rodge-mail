import { describe, expect, it } from "vitest";

import { toUnreadCountRecord } from "./live-data-utils";

describe("live mail data utilities", () => {
  it("keeps the unified total separate from authoritative account totals", () => {
    expect(
      toUnreadCountRecord({
        all: 6,
        byAccount: { gmail: 2, icloud: 4, microsoft: 0 },
      }),
    ).toEqual({ all: 6, gmail: 2, icloud: 4, microsoft: 0 });
  });
});
