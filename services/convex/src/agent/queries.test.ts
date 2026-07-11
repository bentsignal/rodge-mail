import { describe, expect, it } from "vitest";

import { parseMailSearch } from "../mail/search";
import { serializeSearchPlan } from "./queries";

describe("agent query projections", () => {
  it("returns a Convex-serializable plain search plan", () => {
    const projected = serializeSearchPlan(
      parseMailSearch('project from:"Maya" after:2026-07-01'),
    );

    expect(Object.getPrototypeOf(projected)).toBe(Object.prototype);
    expect(projected).toEqual({
      after: Date.UTC(2026, 6, 1),
      lexicalQuery: "Maya project",
      sender: "Maya",
    });
    expect(Object.values(projected)).not.toContain(undefined);
  });
});
