/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts_actions from "../accounts/actions.js";
import type * as accounts_mutations from "../accounts/mutations.js";
import type * as accounts_queries from "../accounts/queries.js";
import type * as agent_audit from "../agent/audit.js";
import type * as agent_credentials from "../agent/credentials.js";
import type * as agent_http from "../agent/http.js";
import type * as agent_internal from "../agent/internal.js";
import type * as agent_policy from "../agent/policy.js";
import type * as agent_projections from "../agent/projections.js";
import type * as agent_queries from "../agent/queries.js";
import type * as agent_search from "../agent/search.js";
import type * as agent_token from "../agent/token.js";
import type * as agent_validators from "../agent/validators.js";
import type * as attachments_actions from "../attachments/actions.js";
import type * as attachments_constants from "../attachments/constants.js";
import type * as attachments_internal from "../attachments/internal.js";
import type * as attachments_mutations from "../attachments/mutations.js";
import type * as auth from "../auth.js";
import type * as classification_actions from "../classification/actions.js";
import type * as classification_audit from "../classification/audit.js";
import type * as classification_backfill from "../classification/backfill.js";
import type * as classification_constants from "../classification/constants.js";
import type * as classification_env from "../classification/env.js";
import type * as classification_importance from "../classification/importance.js";
import type * as classification_internal from "../classification/internal.js";
import type * as classification_jobHelpers from "../classification/jobHelpers.js";
import type * as classification_maintenance from "../classification/maintenance.js";
import type * as classification_mutations from "../classification/mutations.js";
import type * as classification_normalize from "../classification/normalize.js";
import type * as classification_openai from "../classification/openai.js";
import type * as classification_pending from "../classification/pending.js";
import type * as classification_queries from "../classification/queries.js";
import type * as classification_retry from "../classification/retry.js";
import type * as classification_retryPolicy from "../classification/retryPolicy.js";
import type * as classification_signals from "../classification/signals.js";
import type * as classification_stale from "../classification/stale.js";
import type * as crons from "../crons.js";
import type * as desktopAuth from "../desktopAuth.js";
import type * as devSeed from "../devSeed.js";
import type * as devSeedFixtures from "../devSeedFixtures.js";
import type * as devSeedWrites from "../devSeedWrites.js";
import type * as embedding_actions from "../embedding/actions.js";
import type * as embedding_cleanup from "../embedding/cleanup.js";
import type * as embedding_internal from "../embedding/internal.js";
import type * as embedding_maintenance from "../embedding/maintenance.js";
import type * as embedding_mutations from "../embedding/mutations.js";
import type * as embedding_queries from "../embedding/queries.js";
import type * as embedding_queue from "../embedding/queue.js";
import type * as embedding_search from "../embedding/search.js";
import type * as embedding_stale from "../embedding/stale.js";
import type * as embedding_storage from "../embedding/storage.js";
import type * as embedding_validators from "../embedding/validators.js";
import type * as http from "../http.js";
import type * as limiter from "../limiter.js";
import type * as mail_helpers from "../mail/helpers.js";
import type * as mail_icloudCleanup from "../mail/icloudCleanup.js";
import type * as mail_maintenance from "../mail/maintenance.js";
import type * as mail_mutations from "../mail/mutations.js";
import type * as mail_outbox from "../mail/outbox.js";
import type * as mail_queries from "../mail/queries.js";
import type * as mail_readUpdates from "../mail/readUpdates.js";
import type * as mail_replies from "../mail/replies.js";
import type * as mail_search from "../mail/search.js";
import type * as mail_threadState from "../mail/threadState.js";
import type * as mail_types from "../mail/types.js";
import type * as mail_validators from "../mail/validators.js";
import type * as notifications_actions from "../notifications/actions.js";
import type * as notifications_delivery from "../notifications/delivery.js";
import type * as notifications_deliveryState from "../notifications/deliveryState.js";
import type * as notifications_expo from "../notifications/expo.js";
import type * as notifications_internal from "../notifications/internal.js";
import type * as notifications_maintenance from "../notifications/maintenance.js";
import type * as notifications_mutations from "../notifications/mutations.js";
import type * as notifications_payload from "../notifications/payload.js";
import type * as notifications_policy from "../notifications/policy.js";
import type * as notifications_preferences from "../notifications/preferences.js";
import type * as notifications_queries from "../notifications/queries.js";
import type * as notifications_recovery from "../notifications/recovery.js";
import type * as notifications_validators from "../notifications/validators.js";
import type * as outbox_queries from "../outbox/queries.js";
import type * as outbox_recent from "../outbox/recent.js";
import type * as passkeyRecovery from "../passkeyRecovery.js";
import type * as providers_crypto from "../providers/crypto.js";
import type * as providers_env from "../providers/env.js";
import type * as providers_gmail_api from "../providers/gmail/api.js";
import type * as providers_gmail_http from "../providers/gmail/http.js";
import type * as providers_gmail_oauth from "../providers/gmail/oauth.js";
import type * as providers_gmail_tokenAccess from "../providers/gmail/tokenAccess.js";
import type * as providers_icloud_actions from "../providers/icloud/actions.js";
import type * as providers_icloud_client from "../providers/icloud/client.js";
import type * as providers_icloud_credentialAccess from "../providers/icloud/credentialAccess.js";
import type * as providers_icloud_identifiers from "../providers/icloud/identifiers.js";
import type * as providers_icloud_internal from "../providers/icloud/internal.js";
import type * as providers_icloud_normalize from "../providers/icloud/normalize.js";
import type * as providers_icloud_outbox from "../providers/icloud/outbox.js";
import type * as providers_icloud_sync from "../providers/icloud/sync.js";
import type * as providers_icloud_window from "../providers/icloud/window.js";
import type * as providers_microsoft_api from "../providers/microsoft/api.js";
import type * as providers_microsoft_http from "../providers/microsoft/http.js";
import type * as providers_microsoft_oauth from "../providers/microsoft/oauth.js";
import type * as providers_microsoft_tokenAccess from "../providers/microsoft/tokenAccess.js";
import type * as providers_types from "../providers/types.js";
import type * as registrationEmail from "../registrationEmail.js";
import type * as sync_gmailOutbox from "../sync/gmailOutbox.js";
import type * as sync_internal from "../sync/internal.js";
import type * as sync_stale from "../sync/stale.js";
import type * as urls from "../urls.js";
import type * as utils from "../utils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "accounts/actions": typeof accounts_actions;
  "accounts/mutations": typeof accounts_mutations;
  "accounts/queries": typeof accounts_queries;
  "agent/audit": typeof agent_audit;
  "agent/credentials": typeof agent_credentials;
  "agent/http": typeof agent_http;
  "agent/internal": typeof agent_internal;
  "agent/policy": typeof agent_policy;
  "agent/projections": typeof agent_projections;
  "agent/queries": typeof agent_queries;
  "agent/search": typeof agent_search;
  "agent/token": typeof agent_token;
  "agent/validators": typeof agent_validators;
  "attachments/actions": typeof attachments_actions;
  "attachments/constants": typeof attachments_constants;
  "attachments/internal": typeof attachments_internal;
  "attachments/mutations": typeof attachments_mutations;
  auth: typeof auth;
  "classification/actions": typeof classification_actions;
  "classification/audit": typeof classification_audit;
  "classification/backfill": typeof classification_backfill;
  "classification/constants": typeof classification_constants;
  "classification/env": typeof classification_env;
  "classification/importance": typeof classification_importance;
  "classification/internal": typeof classification_internal;
  "classification/jobHelpers": typeof classification_jobHelpers;
  "classification/maintenance": typeof classification_maintenance;
  "classification/mutations": typeof classification_mutations;
  "classification/normalize": typeof classification_normalize;
  "classification/openai": typeof classification_openai;
  "classification/pending": typeof classification_pending;
  "classification/queries": typeof classification_queries;
  "classification/retry": typeof classification_retry;
  "classification/retryPolicy": typeof classification_retryPolicy;
  "classification/signals": typeof classification_signals;
  "classification/stale": typeof classification_stale;
  crons: typeof crons;
  desktopAuth: typeof desktopAuth;
  devSeed: typeof devSeed;
  devSeedFixtures: typeof devSeedFixtures;
  devSeedWrites: typeof devSeedWrites;
  "embedding/actions": typeof embedding_actions;
  "embedding/cleanup": typeof embedding_cleanup;
  "embedding/internal": typeof embedding_internal;
  "embedding/maintenance": typeof embedding_maintenance;
  "embedding/mutations": typeof embedding_mutations;
  "embedding/queries": typeof embedding_queries;
  "embedding/queue": typeof embedding_queue;
  "embedding/search": typeof embedding_search;
  "embedding/stale": typeof embedding_stale;
  "embedding/storage": typeof embedding_storage;
  "embedding/validators": typeof embedding_validators;
  http: typeof http;
  limiter: typeof limiter;
  "mail/helpers": typeof mail_helpers;
  "mail/icloudCleanup": typeof mail_icloudCleanup;
  "mail/maintenance": typeof mail_maintenance;
  "mail/mutations": typeof mail_mutations;
  "mail/outbox": typeof mail_outbox;
  "mail/queries": typeof mail_queries;
  "mail/readUpdates": typeof mail_readUpdates;
  "mail/replies": typeof mail_replies;
  "mail/search": typeof mail_search;
  "mail/threadState": typeof mail_threadState;
  "mail/types": typeof mail_types;
  "mail/validators": typeof mail_validators;
  "notifications/actions": typeof notifications_actions;
  "notifications/delivery": typeof notifications_delivery;
  "notifications/deliveryState": typeof notifications_deliveryState;
  "notifications/expo": typeof notifications_expo;
  "notifications/internal": typeof notifications_internal;
  "notifications/maintenance": typeof notifications_maintenance;
  "notifications/mutations": typeof notifications_mutations;
  "notifications/payload": typeof notifications_payload;
  "notifications/policy": typeof notifications_policy;
  "notifications/preferences": typeof notifications_preferences;
  "notifications/queries": typeof notifications_queries;
  "notifications/recovery": typeof notifications_recovery;
  "notifications/validators": typeof notifications_validators;
  "outbox/queries": typeof outbox_queries;
  "outbox/recent": typeof outbox_recent;
  passkeyRecovery: typeof passkeyRecovery;
  "providers/crypto": typeof providers_crypto;
  "providers/env": typeof providers_env;
  "providers/gmail/api": typeof providers_gmail_api;
  "providers/gmail/http": typeof providers_gmail_http;
  "providers/gmail/oauth": typeof providers_gmail_oauth;
  "providers/gmail/tokenAccess": typeof providers_gmail_tokenAccess;
  "providers/icloud/actions": typeof providers_icloud_actions;
  "providers/icloud/client": typeof providers_icloud_client;
  "providers/icloud/credentialAccess": typeof providers_icloud_credentialAccess;
  "providers/icloud/identifiers": typeof providers_icloud_identifiers;
  "providers/icloud/internal": typeof providers_icloud_internal;
  "providers/icloud/normalize": typeof providers_icloud_normalize;
  "providers/icloud/outbox": typeof providers_icloud_outbox;
  "providers/icloud/sync": typeof providers_icloud_sync;
  "providers/icloud/window": typeof providers_icloud_window;
  "providers/microsoft/api": typeof providers_microsoft_api;
  "providers/microsoft/http": typeof providers_microsoft_http;
  "providers/microsoft/oauth": typeof providers_microsoft_oauth;
  "providers/microsoft/tokenAccess": typeof providers_microsoft_tokenAccess;
  "providers/types": typeof providers_types;
  registrationEmail: typeof registrationEmail;
  "sync/gmailOutbox": typeof sync_gmailOutbox;
  "sync/internal": typeof sync_internal;
  "sync/stale": typeof sync_stale;
  urls: typeof urls;
  utils: typeof utils;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
