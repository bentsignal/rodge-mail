import { describe, expect, it } from "vitest";

import { prepareEmailHtmlForDisplay } from "./email-html";

describe("prepareEmailHtmlForDisplay", () => {
  it("upgrades insecure image sources without changing links", () => {
    expect(
      prepareEmailHtmlForDisplay(
        '<a href="http://example.com"><img src="http://images.example.com/barcode.jpg"></a>',
      ),
    ).toBe(
      '<a href="http://example.com"><img src="https://images.example.com/barcode.jpg"></a>',
    );
  });

  it("resolves normalized and encoded content IDs", () => {
    expect(
      prepareEmailHtmlForDisplay(
        '<img src="cid:barcode%40mail"><img src="CID:%3Clogo%40mail%3E">',
        {
          "<barcode@mail>": "https://files.example.com/barcode",
          "logo@mail": "https://files.example.com/logo",
        },
      ),
    ).toBe(
      '<img src="https://files.example.com/barcode"><img src="https://files.example.com/logo">',
    );
  });

  it("leaves unresolved and non-image URLs unchanged", () => {
    expect(
      prepareEmailHtmlForDisplay(
        '<a href="http://example.com">Open</a><img src="cid:missing">',
      ),
    ).toBe('<a href="http://example.com">Open</a><img src="cid:missing">');
  });
});
