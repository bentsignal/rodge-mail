import { defineSchema, defineTable } from "convex/server";

import {
  vAttachment,
  vMailAccount,
  vMailFolder,
  vMessage,
  vMessageClassification,
  vMessageContent,
  vSyncRun,
  vThread,
} from "./mail/validators";

export default defineSchema(
  {
    mailAccounts: defineTable(vMailAccount)
      .index("by_owner", ["ownerId"])
      .index("by_owner_address", ["ownerId", "address"])
      .index("by_owner_provider_remote", [
        "ownerId",
        "provider",
        "remoteAccountId",
      ]),
    mailFolders: defineTable(vMailFolder)
      .index("by_account_kind", ["accountId", "kind"])
      .index("by_account_remote", ["accountId", "remoteFolderId"]),
    threads: defineTable(vThread)
      .index("by_owner_latest", ["ownerId", "latestMessageAt"])
      .index("by_account_latest", ["accountId", "latestMessageAt"])
      .index("by_account_remote", ["accountId", "remoteThreadId"]),
    messages: defineTable(vMessage)
      .index("by_account_remote", ["accountId", "remoteMessageId"])
      .index("by_thread_received", ["threadId", "receivedAt"])
      .index("by_owner_inbox_received", ["ownerId", "inInbox", "receivedAt"])
      .index("by_account_inbox_received", [
        "accountId",
        "inInbox",
        "receivedAt",
      ])
      .index("by_owner_inbox_bucket_received", [
        "ownerId",
        "inInbox",
        "focusBucket",
        "receivedAt",
      ])
      .index("by_account_inbox_bucket_received", [
        "accountId",
        "inInbox",
        "focusBucket",
        "receivedAt",
      ])
      .index("by_owner_inbox_pinned_received", [
        "ownerId",
        "inInbox",
        "isPinned",
        "receivedAt",
      ])
      .index("by_account_inbox_pinned_received", [
        "accountId",
        "inInbox",
        "isPinned",
        "receivedAt",
      ])
      .searchIndex("search_headers", {
        searchField: "searchText",
        filterFields: ["ownerId", "accountId", "inInbox"],
      }),
    messageContents: defineTable(vMessageContent).index("by_message", [
      "messageId",
    ]),
    attachments: defineTable(vAttachment)
      .index("by_message", ["messageId"])
      .index("by_message_remote", ["messageId", "remoteAttachmentId"]),
    messageClassifications: defineTable(vMessageClassification)
      .index("by_message", ["messageId"])
      .index("by_status", ["status"])
      .index("by_owner_status", ["ownerId", "status"])
      .index("by_owner_bucket_importance", ["ownerId", "bucket", "importance"]),
    syncRuns: defineTable(vSyncRun)
      .index("by_account_created", ["accountId", "createdAt"])
      .index("by_status_created", ["status", "createdAt"]),
  },
  { schemaValidation: true },
);
