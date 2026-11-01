import { describe, expect, it } from "vitest";

import { REPLACEMENT_CHARACTER, toWellFormed, truncateText } from "./text";

const EMOJI = "\u{1F600}";

describe("mail text", () => {
  it("replaces lone surrogates and keeps pairs", () => {
    expect(toWellFormed(`a\uD83Db\uDE00c${EMOJI}`)).toBe(
      `a${REPLACEMENT_CHARACTER}b${REPLACEMENT_CHARACTER}c${EMOJI}`,
    );
  });

  it("truncates before a surrogate pair instead of splitting it", () => {
    expect(truncateText(`ab${EMOJI}`, 3)).toBe("ab");
    expect(truncateText(`ab${EMOJI}`, 4)).toBe(`ab${EMOJI}`);
    expect(truncateText("abcdef", 3)).toBe("abc");
  });
});
