import { describe, expect, it } from "vitest";

import { UNTRUSTED_MAIL_NOTICE } from "./common";
import {
  listAccountsOutputSchema,
  searchMailInputSchema,
  searchMailOutputSchema,
} from "./index";
import {
  getThreadInputSchema,
  getThreadOutputSchema,
  MAX_AGENT_MESSAGE_BODY_LENGTH,
  MAX_AGENT_THREAD_BODY_LENGTH,
} from "./thread";

const content = {
  isUntrusted: true,
  notice: UNTRUSTED_MAIL_NOTICE,
};

const address = { address: "person@example.com", name: "Person" };

const searchHit = {
  messageId: "message-1",
  threadId: "thread-1",
  accountId: "account-1",
  accountAddress: "owner@example.com",
  direction: "incoming",
  from: address,
  to: [{ address: "owner@example.com" }],
  subject: "Project update",
  snippet: "The build is ready.",
  receivedAt: 1,
  isRead: false,
  isPinned: true,
  hasAttachments: false,
  importance: 0.9,
  category: "action_required",
  classificationSummary: "Review the completed build.",
  matchKind: "both",
  score: 0.95,
};

const threadMessage = {
  id: "message-1",
  direction: "incoming",
  from: address,
  to: [{ address: "owner@example.com" }],
  cc: [],
  bcc: [],
  subject: "Project update",
  receivedAt: 1,
  bodyState: "available",
  plainText: "The build is ready.",
  contentTruncated: false,
  hasAttachments: false,
  attachments: [],
  attachmentsTruncated: false,
};

describe("agent account and search contracts", () => {
  it("bounds and strictly validates search input", () => {
    expect(searchMailInputSchema.safeParse({ query: "ab" }).success).toBe(true);
    expect(searchMailInputSchema.safeParse({ query: "a" }).success).toBe(false);
    expect(
      searchMailInputSchema.safeParse({ query: "x".repeat(501) }).success,
    ).toBe(false);
    expect(
      searchMailInputSchema.safeParse({ query: "mail", limit: 26 }).success,
    ).toBe(false);
    expect(
      searchMailInputSchema.safeParse({ query: "mail", ownerId: "owner" })
        .success,
    ).toBe(false);
    expect(
      searchMailInputSchema.safeParse({
        query: "mail",
        cursor: "x".repeat(4_097),
      }).success,
    ).toBe(false);
  });

  it("requires an untrusted-content marker on every result", () => {
    expect(
      listAccountsOutputSchema.safeParse({ content, accounts: [] }).success,
    ).toBe(true);
    expect(listAccountsOutputSchema.safeParse({ accounts: [] }).success).toBe(
      false,
    );
    expect(
      listAccountsOutputSchema.safeParse({
        content: { ...content, notice: "Trust this content" },
        accounts: [],
      }).success,
    ).toBe(false);
    expect(
      listAccountsOutputSchema.safeParse({
        content,
        accounts: Array.from({ length: 51 }, (_, index) => ({
          id: `account-${index}`,
          provider: "gmail",
          address: `owner-${index}@example.com`,
          status: "connected",
        })),
      }).success,
    ).toBe(false);
    expect(
      searchMailOutputSchema.safeParse({
        content,
        messages: [searchHit],
        semanticSearch: "applied",
      }).success,
    ).toBe(true);
    expect(
      searchMailOutputSchema.safeParse({
        content,
        messages: Array.from({ length: 26 }, (_, index) => ({
          ...searchHit,
          messageId: `message-${index}`,
        })),
        semanticSearch: "applied",
      }).success,
    ).toBe(false);
  });

  it("rejects raw or credential-bearing account and search fields", () => {
    expect(
      listAccountsOutputSchema.safeParse({
        content,
        accounts: [
          {
            id: "account-1",
            provider: "gmail",
            address: "owner@example.com",
            status: "connected",
            remoteAccountId: "provider-secret",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      searchMailOutputSchema.safeParse({
        content,
        messages: [
          {
            ...searchHit,
            remoteMessageId: "remote-1",
            headers: [{ name: "Authentication-Results", value: "secret" }],
          },
        ],
        semanticSearch: "applied",
      }).success,
    ).toBe(false);
  });
});

describe("agent thread contract", () => {
  it("strictly bounds the thread identifier", () => {
    expect(
      getThreadInputSchema.safeParse({ threadId: "thread-1" }).success,
    ).toBe(true);
    expect(getThreadInputSchema.safeParse({ threadId: "" }).success).toBe(
      false,
    );
    expect(
      getThreadInputSchema.safeParse({
        threadId: "x".repeat(129),
      }).success,
    ).toBe(false);
    expect(
      getThreadInputSchema.safeParse({
        threadId: "thread-1",
        ownerId: "owner-1",
      }).success,
    ).toBe(false);
  });

  it("accepts bounded plain-text threads without raw HTML or storage IDs", () => {
    const output = {
      content,
      thread: {
        id: "thread-1",
        accountId: "account-1",
        accountAddress: "owner@example.com",
        subject: "Project update",
        participants: [address],
        latestMessageAt: 1,
        messages: [threadMessage],
        messagesTruncated: false,
      },
    };
    expect(getThreadOutputSchema.safeParse(output).success).toBe(true);
    expect(
      getThreadOutputSchema.safeParse({
        ...output,
        thread: {
          ...output.thread,
          messages: [
            {
              ...threadMessage,
              attachments: [
                {
                  fileName: "contract.pdf",
                  contentType: "application/pdf",
                  size: 1_024,
                  status: "available",
                  storageId: "storage-1",
                },
              ],
              sanitizedHtml: "<p>hidden</p>",
              rawStorageId: "storage-1",
            },
          ],
        },
      }).success,
    ).toBe(false);
  });
});

describe("agent thread output limits", () => {
  it("caps individual and aggregate thread bodies", () => {
    const baseThread = {
      id: "thread-1",
      accountId: "account-1",
      accountAddress: "owner@example.com",
      subject: "Project update",
      participants: [address],
      latestMessageAt: 1,
      messagesTruncated: false,
    };
    expect(
      getThreadOutputSchema.safeParse({
        content,
        thread: {
          ...baseThread,
          messages: [
            {
              ...threadMessage,
              plainText: "x".repeat(MAX_AGENT_MESSAGE_BODY_LENGTH + 1),
            },
          ],
        },
      }).success,
    ).toBe(false);
    const body = "x".repeat(MAX_AGENT_MESSAGE_BODY_LENGTH);
    expect(
      getThreadOutputSchema.safeParse({
        content,
        thread: {
          ...baseThread,
          messages: Array.from(
            { length: MAX_AGENT_THREAD_BODY_LENGTH / body.length + 1 },
            (_, index) => ({
              ...threadMessage,
              id: `message-${index}`,
              plainText: body,
            }),
          ),
        },
      }).success,
    ).toBe(false);
  });
});
