import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../../app/styles.css", import.meta.url),
  "utf8",
);

describe("desktop mail shell layout", () => {
  it("reserves a safe compact macOS rail beneath the titlebar", () => {
    expect(styles).toContain("--mail-desktop-rail-width: 92px");
    expect(styles).toContain("--mail-desktop-titlebar-reserve: 60px");
    expect(styles).toContain("width: var(--mail-desktop-rail-width)");
    expect(styles).toContain(
      "padding-top: var(--mail-desktop-titlebar-reserve)",
    );
  });
});
