import { describe, expect, it } from "vitest";

import {
  normalizeRecipientFields,
  normalizeRecipients,
  parseRecipientFields,
  parseRecipientList,
} from "./recipients";

describe("parseRecipientList", () => {
  it("parses comma and semicolon separated recipients", () => {
    expect(
      parseRecipientList(
        "first@example.com; second@example.org, third@example.net",
      ),
    ).toEqual({
      invalid: [],
      recipients: [
        { address: "first@example.com" },
        { address: "second@example.org" },
        { address: "third@example.net" },
      ],
    });
  });

  it("parses display names and quoted commas", () => {
    expect(
      parseRecipientList(
        'Jane Doe <JANE@Example.com>, "Doe, John" <john@example.com>',
      ),
    ).toEqual({
      invalid: [],
      recipients: [
        { address: "jane@example.com", name: "Jane Doe" },
        { address: "john@example.com", name: "Doe, John" },
      ],
    });
  });

  it("deduplicates addresses case-insensitively and keeps the first name", () => {
    expect(
      parseRecipientList(
        "First <same@example.com>; SAME@EXAMPLE.COM; other@example.com",
      ),
    ).toEqual({
      invalid: [],
      recipients: [
        { address: "same@example.com", name: "First" },
        { address: "other@example.com" },
      ],
    });
  });

  it.each([
    "missing-at.example.com",
    "two@@example.com",
    ".leading@example.com",
    "trailing.@example.com",
    "double..dot@example.com",
    "person@example",
    "person@-example.com",
    "person@example-.com",
    "Person person@example.com",
    "Person <person@example.com",
  ])("reports malformed recipient %s", (value) => {
    expect(parseRecipientList(value)).toEqual({
      invalid: [value],
      recipients: [],
    });
  });

  it("returns valid recipients alongside every invalid token", () => {
    expect(
      parseRecipientList(
        "valid@example.com; not-an-email, Also Bad <bad@domain>",
      ),
    ).toEqual({
      invalid: ["not-an-email", "Also Bad <bad@domain>"],
      recipients: [{ address: "valid@example.com" }],
    });
  });

  it("ignores empty separators", () => {
    expect(parseRecipientList(" , ; valid@example.com; ")).toEqual({
      invalid: [],
      recipients: [{ address: "valid@example.com" }],
    });
  });
});

describe("normalizeRecipients", () => {
  it("normalizes, deduplicates, and preserves display names", () => {
    expect(
      normalizeRecipients([
        { address: " PERSON@Example.com ", name: " Person " },
        { address: "person@example.com", name: "Duplicate" },
      ]),
    ).toEqual({
      invalid: [],
      recipients: [{ address: "person@example.com", name: "Person" }],
    });
  });

  it("reports malformed shaped addresses instead of dropping them", () => {
    expect(
      normalizeRecipients([
        { address: "valid@example.com" },
        { address: "invalid" },
      ]),
    ).toEqual({
      invalid: ["invalid"],
      recipients: [{ address: "valid@example.com" }],
    });
  });
});

describe("recipient fields", () => {
  it("deduplicates across To, CC, and BCC in delivery order", () => {
    expect(
      parseRecipientFields({
        bcc: "other@example.com; hidden@example.com",
        cc: "PERSON@example.com; other@example.com",
        to: "person@example.com",
      }).recipients,
    ).toEqual({
      bcc: [{ address: "hidden@example.com" }],
      cc: [{ address: "other@example.com" }],
      to: [{ address: "person@example.com" }],
    });
  });

  it("keeps invalid entries associated with their field", () => {
    expect(
      normalizeRecipientFields({
        bcc: [{ address: "bad-bcc" }],
        cc: [{ address: "bad-cc" }],
        to: [{ address: "bad-to" }],
      }).invalid,
    ).toEqual({
      bcc: ["bad-bcc"],
      cc: ["bad-cc"],
      to: ["bad-to"],
    });
  });
});
