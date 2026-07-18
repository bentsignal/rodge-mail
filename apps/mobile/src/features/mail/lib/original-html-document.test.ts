import { describe, expect, it } from "vitest";

import { createOriginalHtmlDocument } from "./original-html-document";

describe("createOriginalHtmlDocument", () => {
  it("scales fixed-width email markup without rewriting its tables", () => {
    const document = createOriginalHtmlDocument({
      background: "#fff",
      foreground: "#111",
      html: '<table width="900"><tr><td style="width: 800px">Mail</td></tr></table>',
    });

    expect(document).toContain("width=device-width");
    expect(document).toContain("-webkit-text-size-adjust:100%");
    expect(document).toContain(
      "Math.max(message.scrollWidth,document.body.scrollWidth)",
    );
    expect(document).toContain(
      'viewport.setAttribute("content","width="+viewportWidth)',
    );
    expect(document).not.toContain("table-layout:fixed");
    expect(document).not.toContain("word-break:break-word");
    expect(document).toContain(
      '<div id="message"><table width="900"><tr><td style="width: 800px">Mail</td></tr></table></div>',
    );
  });

  it("wraps intrinsically wide text and media", () => {
    const document = createOriginalHtmlDocument({
      background: "#fff",
      foreground: "#111",
      html: "<pre>unbroken-content</pre><img width=1200>",
    });

    expect(document).toContain("white-space:pre-wrap;overflow-wrap:anywhere");
    expect(document).toContain(
      "img,video,svg,canvas{max-width:100%;height:auto}",
    );
  });

  it("reports the scaled document height to the native reader", () => {
    const document = createOriginalHtmlDocument({
      background: "#fff",
      foreground: "#111",
      html: "<p>Mail</p>",
    });

    expect(document).toContain(
      "const scale=Math.min(1,deviceWidth/viewportWidth)",
    );
    expect(document).toContain("document.documentElement.scrollHeight*scale+8");
  });
});
