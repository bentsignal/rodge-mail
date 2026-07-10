import { describe, expect, it } from "vitest";

import { gmailHtmlToPlainText } from "./api";

describe("Gmail HTML messages", () => {
  it("creates readable plain text for HTML-only messages", () => {
    const html = `
      <html>
        <head><style>.hidden { display: none; }</style></head>
        <body>
          <h1>Payment&nbsp;received</h1>
          <p>Hello &amp; welcome.<br>Order &#35;42 is ready.</p>
          <ul><li>Receipt</li><li>Tracking</li></ul>
          <script>doNotInclude()</script>
        </body>
      </html>
    `;

    expect(gmailHtmlToPlainText(html)).toBe(
      "Payment received\n\nHello & welcome.\nOrder #42 is ready.\n\n• Receipt\n• Tracking",
    );
  });

  it("decodes hexadecimal and typographic entities", () => {
    expect(
      gmailHtmlToPlainText("<p>&ldquo;Shipped&rdquo; &mdash; &#x1F680;</p>"),
    ).toBe("“Shipped” — 🚀");
  });
});
