import { describe, expect, it } from "vitest";

import { parseEmailText } from "./email-text";

describe("email text structure", () => {
  it("preserves paragraphs and soft line breaks", () => {
    expect(
      parseEmailText("Hello there,\nthis stays together.\n\nSecond paragraph."),
    ).toEqual([
      {
        content: [
          { type: "text", value: "Hello there,\nthis stays together." },
        ],
        type: "paragraph",
      },
      {
        content: [{ type: "text", value: "Second paragraph." }],
        type: "paragraph",
      },
    ]);
  });

  it("groups quoted reply paragraphs", () => {
    expect(
      parseEmailText(
        "> On Tuesday, Ada wrote:\n> First reply.\n>\n> Second reply.",
      ),
    ).toEqual([
      {
        paragraphs: [
          [{ type: "text", value: "On Tuesday, Ada wrote:\nFirst reply." }],
          [{ type: "text", value: "Second reply." }],
        ],
        type: "quote",
      },
    ]);
  });

  it("groups simple bullet and numbered lists", () => {
    expect(parseEmailText("- Alpha\n* Beta\n\n3. Third\n4) Fourth")).toEqual([
      {
        items: [
          [{ type: "text", value: "Alpha" }],
          [{ type: "text", value: "Beta" }],
        ],
        ordered: false,
        start: undefined,
        type: "list",
      },
      {
        items: [
          [{ type: "text", value: "Third" }],
          [{ type: "text", value: "Fourth" }],
        ],
        ordered: true,
        start: 3,
        type: "list",
      },
    ]);
  });
});

describe("clean-view markdown", () => {
  it("renders headings and inline emphasis without exposing markers", () => {
    expect(
      parseEmailText(
        "## Pickup details\n\nShow **482913** at the *front desk* with `photo ID`.",
        { markdown: true },
      ),
    ).toEqual([
      {
        content: [{ type: "text", value: "Pickup details" }],
        level: 2,
        type: "heading",
      },
      {
        content: [
          { type: "text", value: "Show " },
          { type: "strong", value: "482913" },
          { type: "text", value: " at the " },
          { type: "emphasis", value: "front desk" },
          { type: "text", value: " with " },
          { type: "code", value: "photo ID" },
          { type: "text", value: "." },
        ],
        type: "paragraph",
      },
    ]);
  });

  it("uses markdown link labels and rejects unsafe markdown links", () => {
    expect(
      parseEmailText(
        "Open [pickup details](https://example.com/pickup) or [unsafe](javascript:alert).",
        { markdown: true },
      ),
    ).toEqual([
      {
        content: [
          { type: "text", value: "Open " },
          {
            display: "pickup details",
            href: "https://example.com/pickup",
            type: "link",
          },
          {
            type: "text",
            value: " or [unsafe](javascript:alert).",
          },
        ],
        type: "paragraph",
      },
    ]);
  });

  it("leaves markdown markers literal outside clean-view mode", () => {
    expect(parseEmailText("Use **literal** markers.")).toEqual([
      {
        content: [{ type: "text", value: "Use **literal** markers." }],
        type: "paragraph",
      },
    ]);
  });
});

describe("safe email text content", () => {
  it("decodes common visible entities without interpreting markup", () => {
    expect(
      parseEmailText(
        "Tom &amp; Ada wrote &lt;b&gt;hello&lt;/b&gt; &mdash; okay&nbsp;now&#x2026;",
      ),
    ).toEqual([
      {
        content: [
          {
            type: "text",
            value: "Tom & Ada wrote <b>hello</b> — okay now…",
          },
        ],
        type: "paragraph",
      },
    ]);
  });

  it("linkifies safe URLs with concise labels and preserves hrefs", () => {
    expect(
      parseEmailText(
        "Visit https://www.example.com/a/long/path?from=mail&amp;ok=1, or mailto:hello@example.com?subject=Hi.",
      ),
    ).toEqual([
      {
        content: [
          { type: "text", value: "Visit " },
          {
            display: "example.com",
            href: "https://www.example.com/a/long/path?from=mail&ok=1",
            type: "link",
          },
          { type: "text", value: ", or " },
          {
            display: "hello@example.com",
            href: "mailto:hello@example.com?subject=Hi",
            type: "link",
          },
          { type: "text", value: "." },
        ],
        type: "paragraph",
      },
    ]);
  });
});

describe("common address linkification", () => {
  it("linkifies common bare web and email addresses", () => {
    expect(
      parseEmailText(
        "Open www.example.com/inbox or contact hello+mail@example.co.uk.",
      ),
    ).toEqual([
      {
        content: [
          { type: "text", value: "Open " },
          {
            display: "example.com",
            href: "https://www.example.com/inbox",
            type: "link",
          },
          { type: "text", value: " or contact " },
          {
            display: "hello+mail@example.co.uk",
            href: "mailto:hello+mail@example.co.uk",
            type: "link",
          },
          { type: "text", value: "." },
        ],
        type: "paragraph",
      },
    ]);
  });

  it("preserves balanced URL delimiters while trimming prose punctuation", () => {
    expect(
      parseEmailText(
        "See https://example.com/wiki/Function_(mathematics), then (https://example.com/docs).",
      ),
    ).toEqual([
      {
        content: [
          { type: "text", value: "See " },
          {
            display: "example.com",
            href: "https://example.com/wiki/Function_(mathematics)",
            type: "link",
          },
          { type: "text", value: ", then (" },
          {
            display: "example.com",
            href: "https://example.com/docs",
            type: "link",
          },
          { type: "text", value: ")." },
        ],
        type: "paragraph",
      },
    ]);
  });
});

describe("unsafe email text content", () => {
  it("leaves unsupported and header-injection schemes inert", () => {
    expect(
      parseEmailText(
        "javascript:alert(1) mailto:hello@example.com?subject=Hi%0ABcc:bad@example.com",
      ),
    ).toEqual([
      {
        content: [
          {
            type: "text",
            value:
              "javascript:alert(1) mailto:hello@example.com?subject=Hi%0ABcc:bad@example.com",
          },
        ],
        type: "paragraph",
      },
    ]);
  });
});
