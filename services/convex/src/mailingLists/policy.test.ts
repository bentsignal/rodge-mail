import { describe, expect, it } from "vitest";

import {
  getMailingListInfo,
  isSafeOneClickUrl,
  messageMatchesSuppression,
} from "./policy";

const newsletter = {
  direction: "incoming" as const,
  from: { address: "news@updates.example", name: "Example Weekly" },
  headers: [
    { name: "List-ID", value: "Example News <weekly.updates.example>" },
    {
      name: "List-Unsubscribe",
      value:
        "<mailto:leave@updates.example?subject=remove%20me>, <https://updates.example/unsubscribe/token>",
    },
    { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
  ],
};

describe("mailing-list detection", () => {
  it("prefers a standards-based one-click URL and preserves email fallback", () => {
    expect(getMailingListInfo(newsletter)).toEqual({
      displayName: "Example News",
      listId: "weekly.updates.example",
      mailto: {
        address: "leave@updates.example",
        body: "Please unsubscribe me from this mailing list.",
        subject: "remove me",
      },
      oneClickUrl: "https://updates.example/unsubscribe/token",
      remoteMethod: "one_click",
      senderAddress: "news@updates.example",
    });
  });

  it("does not automatically POST an HTTPS link without the one-click header", () => {
    const info = getMailingListInfo({
      ...newsletter,
      headers: newsletter.headers.filter(
        (header) => header.name !== "List-Unsubscribe-Post",
      ),
    });
    expect(info?.remoteMethod).toBe("email");
    expect(info?.oneClickUrl).toBeUndefined();
  });

  it("matches the stable list ID even when the sender changes", () => {
    expect(
      messageMatchesSuppression(
        {
          ...newsletter,
          from: { address: "campaign-42@updates.example" },
        },
        "newsletter",
        {
          listId: "weekly.updates.example",
          senderAddress: "news@updates.example",
        },
      ),
    ).toBe(true);
  });

  it("does not suppress ordinary transactional mail from the same sender", () => {
    expect(
      messageMatchesSuppression(
        {
          direction: "incoming",
          from: { address: "news@updates.example" },
          headers: [],
        },
        "transactional",
        { senderAddress: "news@updates.example" },
      ),
    ).toBe(false);
  });

  it("suppresses a sender again when classification identifies a headerless newsletter", () => {
    expect(
      messageMatchesSuppression(
        {
          direction: "incoming",
          from: { address: "news@updates.example" },
          headers: [],
        },
        "newsletter",
        { senderAddress: "news@updates.example" },
      ),
    ).toBe(true);
  });
});

describe("one-click URL safety", () => {
  it.each([
    "http://updates.example/unsubscribe",
    "https://localhost/unsubscribe",
    "https://127.0.0.1/unsubscribe",
    "https://10.0.0.8/unsubscribe",
    "https://[::1]/unsubscribe",
    "https://updates.example:8443/unsubscribe",
  ])("rejects unsafe endpoint %s", (url) => {
    expect(isSafeOneClickUrl(url)).toBe(false);
  });

  it("accepts a public HTTPS endpoint", () => {
    expect(isSafeOneClickUrl("https://mail.example/unsubscribe/abc")).toBe(
      true,
    );
  });
});
