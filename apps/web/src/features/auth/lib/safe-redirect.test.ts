import { describe, expect, it } from "vitest";

import { getSafeAppRedirect } from "./safe-redirect";

describe("getSafeAppRedirect", () => {
  it.each([undefined, null, "", "messages/123", "https://evil.test"])(
    "falls back for non-root-relative input %s",
    (value) => {
      expect(getSafeAppRedirect(value)).toBe("/");
    },
  );

  it.each([
    "//evil.test/collect",
    "/\\evil.test/collect",
    "/messages\\evil",
    "/messages\nset-cookie: bad",
  ])("rejects an ambiguous or protocol-relative redirect %s", (value) => {
    expect(getSafeAppRedirect(value)).toBe("/");
  });

  it("preserves a valid in-app path, query, and fragment", () => {
    expect(
      getSafeAppRedirect("/messages/mail_123?mailbox=account_456#reader"),
    ).toBe("/messages/mail_123?mailbox=account_456#reader");
  });
});
