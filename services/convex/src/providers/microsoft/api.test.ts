/* eslint-disable complexity, max-lines-per-function, no-restricted-syntax, @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-base-to-string, @typescript-eslint/require-await -- Graph adapter tests model stateful fetch boundaries and representative branded IDs. */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../_generated/dataModel";
import type { OutboxPayload } from "../types";
import { MicrosoftGraphAdapter } from "./api";

const basePayload = {
  _id: "outbox-1" as Id<"outboxMessages">,
  accountId: "account-1" as Id<"mailAccounts">,
  attachments: [
    {
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "text/plain",
      fileName: "notes.txt",
      size: 3,
    },
  ],
  bcc: [{ address: "hidden@example.com" }],
  cc: [{ address: "copy@example.com" }],
  from: "owner@example.com",
  plainText: "Reply body",
  subject: "Re: Project",
  to: [{ address: "sender@example.com" }],
} satisfies OutboxPayload;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Microsoft reply delivery", () => {
  it("records and prepares a Graph reply draft before sending it", async () => {
    const requests: { body: unknown; method: string; url: string }[] = [];
    const events: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        requests.push({
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
          method,
          url,
        });
        if (url.endsWith("/createReply")) {
          events.push("created");
          return jsonResponse({ id: "reply-draft-1" });
        }
        if (method === "PATCH") {
          events.push("updated");
          return jsonResponse({ id: "reply-draft-1", isDraft: true });
        }
        if (method === "GET") {
          events.push("listed");
          return jsonResponse({ value: [] });
        }
        if (url.endsWith("/attachments")) {
          events.push("attached");
          return jsonResponse({ id: "attachment-1" });
        }
        events.push("sent");
        return emptyResponse();
      }),
    );

    const result = await new MicrosoftGraphAdapter().sendPlainText(
      "access-token",
      { ...basePayload, replyToRemoteMessageId: "source/message-1" },
      async (draftId) => {
        events.push(`recorded:${draftId}`);
      },
    );

    expect(result).toEqual({ remoteMessageId: "reply-draft-1" });
    expect(events).toEqual([
      "created",
      "recorded:reply-draft-1",
      "updated",
      "listed",
      "attached",
      "sent",
    ]);
    expect(requests.map(({ method, url }) => ({ method, url }))).toEqual([
      {
        method: "POST",
        url: "https://graph.microsoft.com/v1.0/me/messages/source%2Fmessage-1/createReply",
      },
      {
        method: "PATCH",
        url: "https://graph.microsoft.com/v1.0/me/messages/reply-draft-1",
      },
      {
        method: "GET",
        url: "https://graph.microsoft.com/v1.0/me/messages/reply-draft-1/attachments?$select=id,contentId&$top=10",
      },
      {
        method: "POST",
        url: "https://graph.microsoft.com/v1.0/me/messages/reply-draft-1/attachments",
      },
      {
        method: "POST",
        url: "https://graph.microsoft.com/v1.0/me/messages/reply-draft-1/send",
      },
    ]);
    expect(requests[1]?.body).toMatchObject({
      bccRecipients: [{ emailAddress: { address: "hidden@example.com" } }],
      body: { content: "Reply body", contentType: "Text" },
      ccRecipients: [{ emailAddress: { address: "copy@example.com" } }],
      toRecipients: [{ emailAddress: { address: "sender@example.com" } }],
    });
    expect(requests[3]?.body).toMatchObject({
      "@odata.type": "#microsoft.graph.fileAttachment",
      contentBytes: "AQID",
      contentId: "outbox-1-0@rodge-mail.local",
      name: "notes.txt",
    });
  });

  it("resumes a recorded reply draft without recreating or reattaching it", async () => {
    const requests: { method: string; url: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        requests.push({ method, url });
        if (url.includes("?$select=id,isDraft")) {
          return jsonResponse({ id: "reply-draft-1", isDraft: true });
        }
        if (method === "GET") {
          return jsonResponse({
            value: [{ contentId: "outbox-1-0@rodge-mail.local" }],
          });
        }
        return method === "PATCH"
          ? jsonResponse({ id: "reply-draft-1", isDraft: true })
          : emptyResponse();
      }),
    );

    await new MicrosoftGraphAdapter().sendPlainText("access-token", {
      ...basePayload,
      remoteMessageId: "reply-draft-1",
      replyToRemoteMessageId: "source-message-1",
    });

    expect(requests).toEqual([
      {
        method: "GET",
        url: "https://graph.microsoft.com/v1.0/me/messages/reply-draft-1?$select=id,isDraft",
      },
      {
        method: "PATCH",
        url: "https://graph.microsoft.com/v1.0/me/messages/reply-draft-1",
      },
      {
        method: "GET",
        url: "https://graph.microsoft.com/v1.0/me/messages/reply-draft-1/attachments?$select=id,contentId&$top=10",
      },
      {
        method: "POST",
        url: "https://graph.microsoft.com/v1.0/me/messages/reply-draft-1/send",
      },
    ]);
  });

  it("resumes partially prepared reply attachments without duplicating completed uploads", async () => {
    const payload = {
      ...basePayload,
      attachments: [
        ...basePayload.attachments,
        {
          bytes: new Uint8Array([4, 5, 6]),
          contentType: "text/plain",
          fileName: "more-notes.txt",
          size: 3,
        },
      ],
      replyToRemoteMessageId: "source-message-1",
    } satisfies OutboxPayload;
    const attachmentAttempts: string[] = [];
    const uploadedContentIds = new Set<string>();
    let recordedDraftId: string | undefined;
    let interruptSecondAttachment = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.endsWith("/createReply")) {
          return jsonResponse({ id: "reply-draft-2" });
        }
        if (url.includes("?$select=id,isDraft")) {
          return jsonResponse({ id: "reply-draft-2", isDraft: true });
        }
        if (method === "PATCH") {
          return jsonResponse({ id: "reply-draft-2", isDraft: true });
        }
        if (method === "GET") {
          return jsonResponse({
            value: [...uploadedContentIds].map((contentId) => ({ contentId })),
          });
        }
        if (url.endsWith("/attachments")) {
          const body = JSON.parse(String(init?.body)) as { contentId: string };
          attachmentAttempts.push(body.contentId);
          if (
            body.contentId === "outbox-1-1@rodge-mail.local" &&
            interruptSecondAttachment
          ) {
            interruptSecondAttachment = false;
            throw new Error("interrupted after first attachment");
          }
          uploadedContentIds.add(body.contentId);
        }
        return emptyResponse();
      }),
    );

    await expect(
      new MicrosoftGraphAdapter().sendPlainText(
        "access-token",
        payload,
        async (draftId) => {
          recordedDraftId = draftId;
        },
      ),
    ).rejects.toThrow("interrupted after first attachment");
    expect(recordedDraftId).toBe("reply-draft-2");
    expect(uploadedContentIds).toEqual(
      new Set(["outbox-1-0@rodge-mail.local"]),
    );

    await new MicrosoftGraphAdapter().sendPlainText("access-token", {
      ...payload,
      remoteMessageId: recordedDraftId,
    });

    expect(uploadedContentIds).toEqual(
      new Set(["outbox-1-0@rodge-mail.local", "outbox-1-1@rodge-mail.local"]),
    );
    expect(attachmentAttempts).toEqual([
      "outbox-1-0@rodge-mail.local",
      "outbox-1-1@rodge-mail.local",
      "outbox-1-1@rodge-mail.local",
    ]);
  });
});

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function emptyResponse() {
  return new Response(null, { status: 204 });
}
