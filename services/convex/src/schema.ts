import { defineSchema, defineTable } from "convex/server";

import { vAgentAuditEvent, vAgentCredential } from "./agent/validators";
import {
  vMessageEmbedding,
  vMessageEmbeddingJob,
} from "./embedding/validators";
import { vArchivedMessageTombstone } from "./mail/archive";
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
    agentCredentials: defineTable(vAgentCredential)
      .index("by_token_hash", ["tokenHash"])
      .index("by_owner", ["ownerId"])
      .index("by_owner_revoked_expires", ["ownerId", "revokedAt", "expiresAt"])
      .index("by_expires", ["expiresAt"]),
    agentAuditEvents: defineTable(vAgentAuditEvent)
      .index("by_created", ["createdAt"])
      .index("by_owner_created", ["ownerId", "createdAt"])
      .index("by_credential_created", ["credentialId", "createdAt"]),
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
      .index("by_owner_pin_latest", [
        "ownerId",
        "isPinned",
        "latestInboxMessageAt",
      ])
      .index("by_owner_unread", ["ownerId", "unreadCount"])
      .index("by_account_latest", ["accountId", "latestMessageAt"])
      .index("by_account_pin_latest", [
        "accountId",
        "isPinned",
        "latestInboxMessageAt",
      ])
      .index("by_account_remote", ["accountId", "remoteThreadId"]),
    messages: defineTable(vMessage)
      .index("by_account_remote", ["accountId", "remoteMessageId"])
      .index("by_account_received", ["accountId", "receivedAt"])
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
      .index("by_archived", ["archivedAt"])
      .searchIndex("search_headers", {
        searchField: "searchText",
        filterFields: ["ownerId", "accountId", "inInbox", "isRead"],
      }),
    archivedMessageTombstones: defineTable(vArchivedMessageTombstone)
      .index("by_account_remote", ["accountId", "remoteMessageId"])
      .index("by_owner_archived", ["ownerId", "archivedAt"]),
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
      .index("by_owner_status_importance", ["ownerId", "status", "importance"]),
    messageEmbeddingJobs: defineTable(vMessageEmbeddingJob)
      .index("by_message", ["messageId"])
      .index("by_status", ["status"])
      .index("by_owner_status", ["ownerId", "status"])
      .index("by_owner_reason", ["ownerId", "reason"]),
    messageEmbeddings: defineTable(vMessageEmbedding)
      .index("by_message", ["messageId"])
      .index("by_owner", ["ownerId"])
      .index("by_owner_reason", ["ownerId", "reason"])
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
      .index("by_owner_device", ["ownerId", "deviceId"])
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
      .index("by_message", ["messageId"])
      .index("by_status_updated", ["status", "updatedAt"]),
    notificationPushTickets: defineTable(vNotificationPushTicket)
      .index("by_delivery", ["deliveryId"])
      .index("by_expo_ticket", ["expoTicketId"]),
  },
  { schemaValidation: true },
);
