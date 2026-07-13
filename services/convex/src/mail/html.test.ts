import { describe, expect, it } from "vitest";

import { emailHtmlToPlainText, sanitizeEmailHtml } from "./html";

describe("email HTML", () => {
  it("removes active content while preserving readable mail layout", () => {
    const html = sanitizeEmailHtml(`
      <div onclick="steal()"><h1>Shipment update</h1>
      <script>steal()</script><p>Your package arrives Friday.</p>
      <a href="https://example.com/track">Track it</a></div>
    `);

    expect(html).toContain("Shipment update");
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
  });

  it("converts HTML-only provider bodies into useful plain text", () => {
    expect(
      emailHtmlToPlainText(
        "<p>Hello Shawn,</p><ul><li>First update</li><li>Second update</li></ul>",
      ),
    ).toBe("Hello Shawn,\n• First update\n• Second update");
  });
});
