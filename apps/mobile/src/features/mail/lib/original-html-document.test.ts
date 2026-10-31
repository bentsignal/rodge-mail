import { describe, expect, it } from "vitest";

import {
  createOriginalHtmlDocument,
  parseOriginalHtmlMessage,
} from "./original-html-document";

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
    expect(document).toContain(
      'post("height:"+(document.documentElement.scrollHeight*scale+8))',
    );
  });

  it("sends link taps to the app instead of navigating the web view", () => {
    const document = createOriginalHtmlDocument({
      background: "#fff",
      foreground: "#111",
      html: '<a href="https://example.com" target="_blank">Open</a>',
    });

    expect(document).toContain('document.addEventListener("click"');
    expect(document).toContain('closest("a[href]")');
    expect(document).toContain("event.preventDefault()");
  });

  it("upgrades remote images and resolves inline content IDs", () => {
    const document = createOriginalHtmlDocument({
      background: "#fff",
      foreground: "#111",
      html: '<img src="http://images.example.com/barcode"><img src="cid:logo@mail">',
      inlineImageUrls: {
        "<logo@mail>": "https://files.example.com/logo",
      },
    });

    expect(document).toContain(
      '<img src="https://images.example.com/barcode"><img src="https://files.example.com/logo">',
    );
    expect(document).toContain('image.addEventListener("load",fit)');
  });
});

describe("parseOriginalHtmlMessage", () => {
  it("reads height reports", () => {
    expect(parseOriginalHtmlMessage("height:640.5")).toEqual({
      type: "height",
      height: 640.5,
    });
  });

  it("reads web, mail, and phone links", () => {
    for (const url of [
      "https://example.com/a?b=c:d",
      "http://example.com",
      "mailto:hello@example.com",
      "tel:+15555550100",
    ]) {
      expect(parseOriginalHtmlMessage(`link:${url}`)).toEqual({
        type: "link",
        url,
      });
    }
  });

  it("ignores other schemes and malformed messages", () => {
    expect(
      parseOriginalHtmlMessage("link:javascript:alert(1)"),
    ).toBeUndefined();
    expect(parseOriginalHtmlMessage("link:file:///etc/hosts")).toBeUndefined();
    expect(parseOriginalHtmlMessage("height:tall")).toBeUndefined();
    expect(parseOriginalHtmlMessage("640")).toBeUndefined();
  });
});
