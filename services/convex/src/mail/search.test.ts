import { describe, expect, it } from "vitest";

import {
  createMessageSearchText,
  matchesMailSearch,
  parseMailSearch,
} from "./search";

const now = Date.parse("2026-07-10T15:30:00.000Z");

describe("mail search parsing", () => {
  it("extracts a natural sender, topic, and relative date", () => {
    expect(
      parseMailSearch("emails from Sarah last week about budget", now),
    ).toEqual({
      after: Date.parse("2026-06-29T00:00:00.000Z"),
      before: Date.parse("2026-07-06T00:00:00.000Z"),
      lexicalQuery: "Sarah budget",
      sender: "Sarah",
    });
  });

  it("extracts explicit sender, subject, and date operators", () => {
    expect(
      parseMailSearch(
        'from:alex@example.com subject:"launch plan" after:2026-07-01 before:2026-07-10',
        now,
      ),
    ).toEqual({
      after: Date.parse("2026-07-01T00:00:00.000Z"),
      before: Date.parse("2026-07-10T00:00:00.000Z"),
      lexicalQuery: "alex@example.com launch plan",
      sender: "alex@example.com",
      subject: "launch plan",
    });
  });

  it("uses UTC day boundaries for yesterday", () => {
    expect(parseMailSearch("yesterday", now)).toEqual({
      after: Date.parse("2026-07-09T00:00:00.000Z"),
      before: Date.parse("2026-07-10T00:00:00.000Z"),
      lexicalQuery: "",
    });
  });

  it("finds mail from a specific number of days ago", () => {
    expect(
      parseMailSearch("mail from Sarah 3 days ago about budget", now),
    ).toEqual({
      after: Date.parse("2026-07-07T00:00:00.000Z"),
      before: Date.parse("2026-07-08T00:00:00.000Z"),
      lexicalQuery: "Sarah budget",
      sender: "Sarah",
    });
  });

  it("finds mail within a relative week range", () => {
    expect(parseMailSearch("order updates in the past 2 weeks", now)).toEqual({
      after: now - 14 * 24 * 60 * 60 * 1000,
      before: now + 1,
      lexicalQuery: "order updates",
    });
  });

  it("finds mail older or newer than a relative age", () => {
    expect(parseMailSearch("invoices older than 30 days", now)).toEqual({
      before: now - 30 * 24 * 60 * 60 * 1000,
      lexicalQuery: "invoices",
    });
    expect(parseMailSearch("security alerts newer than 1 week", now)).toEqual({
      after: now - 7 * 24 * 60 * 60 * 1000,
      lexicalQuery: "security alerts",
    });
  });
});

describe("mail search matching and indexing", () => {
  it("applies sender, subject, and received date constraints", () => {
    const plan = parseMailSearch(
      'from:"Sarah Jones" subject:budget on:2026-07-09',
      now,
    );
    expect(
      matchesMailSearch(
        {
          from: { address: "sarah@example.com", name: "Sarah Jones" },
          receivedAt: Date.parse("2026-07-09T18:00:00.000Z"),
          subject: "Q3 Budget Review",
        },
        plan,
      ),
    ).toBe(true);
  });

  it("normalizes and bounds body content in exact-search text", () => {
    const searchText = createMessageSearchText({
      accountAddress: "me@example.com",
      body: `Quarterly\u0000 forecast ${"x".repeat(30_000)}`,
      cc: [],
      from: { address: "sarah@example.com", name: "Ｓａｒａｈ" },
      snippet: "Preview",
      subject: "Budget",
      to: [{ address: "me@example.com" }],
    });
    expect(searchText).toContain("sarah");
    expect(searchText).toContain("quarterly forecast");
    expect(searchText.length).toBeLessThan(21_000);
  });
});
