import { describe, expect, it } from "vitest";

import { summarize } from "./frame-summary";

describe("frame summary", () => {
  it("reports a steady 60 Hz recording as smooth", () => {
    const report = summarize(Array.from({ length: 60 }, () => 1000 / 60));

    expect(report).toMatchObject({
      dropped: 0,
      frames: 60,
      hz: 60,
      slow: 0,
      worst: [],
      worstMs: 16.7,
    });
  });

  it("counts hitches against the typical frame", () => {
    const report = summarize([
      ...Array.from({ length: 100 }, () => 8.3),
      25,
      40,
    ]);

    expect(report.hz).toBe(120);
    expect(report.slow).toBe(2);
    expect(report.dropped).toBe(6);
    expect(report.worst).toEqual([40, 25]);
    expect(report.timeline).toEqual(["830+25", "855+40"]);
  });
});
