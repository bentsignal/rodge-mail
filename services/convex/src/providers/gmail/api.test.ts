/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-base-to-string, @typescript-eslint/require-await -- Gmail adapter tests model fetch boundaries and representative branded IDs. */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { GmailAdapter, gmailHtmlToPlainText } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe("Gmail attachment delivery", () => {
  it("sends a multipart MIME message with named attachment bytes", async () => {
    let rawMessage = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/messages?")) {
          return Response.json({ messages: [] });
        }
        const body = JSON.parse(String(init?.body)) as { raw: string };
        rawMessage = decodeBase64UrlText(body.raw);
        return Response.json({ id: "sent-message-1" });
      }),
    );

    await new GmailAdapter().sendMessage("access-token", {
      _id: "outbox-1" as Id<"outboxMessages">,
      accountId: "account-1" as Id<"mailAccounts">,
      attachments: [
        {
          bytes: new Uint8Array([1, 2, 3]),
          contentType: "text/plain",
          fileName: "field notes.txt",
          size: 3,
        },
      ],
      bcc: [],
      cc: [],
      from: "owner@example.com",
      plainText: "Attached notes",
      subject: "Notes",
      to: [{ address: "recipient@example.com" }],
    });

    expect(rawMessage).toContain("Content-Type: multipart/mixed");
    expect(rawMessage).toContain("filename*=UTF-8''field%20notes.txt");
    expect(rawMessage).toContain(
      "Content-Transfer-Encoding: base64\r\n\r\nAQID",
    );
  });
});

function decodeBase64UrlText(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(base64, "base64").toString("utf8");
}
