import { defineSchema, defineTable } from "convex/server";

import {
  vMessageEmbedding,
  vMessageEmbeddingJob,
} from "./embedding/validators";
import {
  vAttachment,
  vDraftAttachment,
  vMailAccount,
  vMailFolder,
  vMessage,
  vMessageClassification,
  vMessageContent,
  vOutboxMessage,
  vProviderCredential,
  vProviderOAuthState,
  vSyncRun,
  vThread,
} from "./mail/validators";
import {
  vAccountNotificationPreference,
  vMobilePushToken,
  vNotificationDelivery,
  vNotificationPreference,
  vNotificationPushTicket,
} from "./notifications/validators";

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
    messageEmbeddingJobs: defineTable(vMessageEmbeddingJob)
      .index("by_message", ["messageId"])
      .index("by_status", ["status"])
      .index("by_owner_status", ["ownerId", "status"]),
    messageEmbeddings: defineTable(vMessageEmbedding)
      .index("by_message", ["messageId"])
      .index("by_owner", ["ownerId"])
      .vectorIndex("search_vector", {
        vectorField: "vector",
        dimensions: 512,
        filterFields: ["ownerId", "accountId"],
      }),
    syncRuns: defineTable(vSyncRun)
      .index("by_account_created", ["accountId", "createdAt"])
      .index("by_account_status_created", ["accountId", "status", "createdAt"])
      .index("by_status_created", ["status", "createdAt"]),
    providerCredentials: defineTable(vProviderCredential)
      .index("by_account", ["accountId"])
      .index("by_owner_provider", ["ownerId", "provider"]),
    providerOAuthStates: defineTable(vProviderOAuthState)
      .index("by_state_hash", ["stateHash"])
      .index("by_owner_created", ["ownerId", "createdAt"]),
    outboxMessages: defineTable(vOutboxMessage)
      .index("by_account_idempotency", ["accountId", "idempotencyKey"])
      .index("by_owner_created", ["ownerId", "createdAt"])
      .index("by_owner_status_created", ["ownerId", "status", "createdAt"])
      .index("by_status_created", ["status", "createdAt"]),
    draftAttachments: defineTable(vDraftAttachment)
      .index("by_owner_status_created", ["ownerId", "status", "createdAt"])
      .index("by_status_created", ["status", "createdAt"])
      .index("by_outbox", ["outboxId"])
      .index("by_storage", ["storageId"]),
    mobilePushTokens: defineTable(vMobilePushToken)
      .index("by_owner", ["ownerId"])
      .index("by_token", ["token"]),
    notificationPreferences: defineTable(vNotificationPreference).index(
      "by_owner",
      ["ownerId"],
    ),
    accountNotificationPreferences: defineTable(vAccountNotificationPreference)
      .index("by_owner", ["ownerId"])
      .index("by_owner_account", ["ownerId", "accountId"]),
    notificationDeliveries: defineTable(vNotificationDelivery)
      .index("by_owner_created", ["ownerId", "createdAt"])
      .index("by_message", ["messageId"]),
    notificationPushTickets: defineTable(vNotificationPushTicket)
      .index("by_delivery", ["deliveryId"])
      .index("by_expo_ticket", ["expoTicketId"]),
  },
  { schemaValidation: true },
);
