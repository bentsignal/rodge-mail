import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../../app/styles.css", import.meta.url),
  "utf8",
);
const sharedButton = readFileSync(
  new URL("../../../../../shared/ui-web/src/button.tsx", import.meta.url),
  "utf8",
);

describe("web interaction affordances", () => {
  it("uses pointer cursors for native and ARIA interactive controls", () => {
    expect(styles).toContain("button:not(:disabled)");
    expect(styles).toContain('[role="button"]');
    expect(styles).toContain('[role="radio"]');
    expect(styles).toContain("cursor: pointer");
  });

  it("keeps the not-allowed cursor reachable on disabled buttons", () => {
    expect(styles).toContain("cursor: not-allowed");
    expect(sharedButton).toContain("disabled:cursor-not-allowed");
    expect(sharedButton).not.toContain("disabled:pointer-events-none");
  });
});
