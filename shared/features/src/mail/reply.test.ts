import { describe, expect, it } from "vitest";

import { getReplyAddress } from "./reply";

const owner = "owner@example.com";

describe("reply recipient selection", () => {
  it("prefers the first non-self Reply-To address", () => {
    expect(
      getReplyAddress(
        [
          {
            from: { address: "sender@example.com" },
            replyTo: [
              { address: owner },
              { address: "replies@example.com" },
              { address: "other@example.com" },
            ],
            to: [{ address: owner }],
          },
        ],
        owner,
      ),
    ).toBe("replies@example.com");
  });

  it("uses a non-self To recipient for an outgoing-only thread", () => {
    expect(
      getReplyAddress(
        [
          {
            from: { address: owner },
            to: [{ address: owner }, { address: "recipient@example.com" }],
          },
        ],
        owner,
      ),
    ).toBe("recipient@example.com");
  });

  it("returns undefined when a thread contains only the owner", () => {
    expect(
      getReplyAddress(
        [
          {
            from: { address: owner },
            replyTo: [{ address: owner }],
            to: [{ address: owner }],
          },
        ],
        owner,
      ),
    ).toBeUndefined();
  });
});
