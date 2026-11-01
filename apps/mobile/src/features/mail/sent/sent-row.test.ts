import { describe, expect, it } from "vitest";

import type { SentRow } from "./sent-row";
import { filterSentRows } from "./sent-row";

function row(subject: string, name: string, address: string) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- The filter reads only these fields.
  return { snippet: "body text", subject, to: [{ address, name }] } as SentRow;
}

describe("filterSentRows", () => {
  const rows = [
    row("Quarterly numbers", "Finance", "finance@northwind.example"),
    row("Weekend hike?", "Jordan", "jordan@example.org"),
  ];

  it("keeps every row without a search", () => {
    expect(filterSentRows(rows, "  ")).toEqual(rows);
  });

  it("matches subjects and recipients", () => {
    expect(filterSentRows(rows, "quarterly")).toEqual([rows[0]]);
    expect(filterSentRows(rows, "JORDAN@")).toEqual([rows[1]]);
    expect(filterSentRows(rows, "body")).toEqual(rows);
    expect(filterSentRows(rows, "nothing")).toEqual([]);
  });
});
