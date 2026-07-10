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
import type * as attachments_actions from "../attachments/actions.js";
import type * as attachments_constants from "../attachments/constants.js";
import type * as attachments_internal from "../attachments/internal.js";
import type * as attachments_mutations from "../attachments/mutations.js";
import type * as auth from "../auth.js";
import type * as classification_actions from "../classification/actions.js";
import type * as classification_constants from "../classification/constants.js";
import type * as classification_env from "../classification/env.js";
import type * as classification_internal from "../classification/internal.js";
import type * as classification_jobHelpers from "../classification/jobHelpers.js";
import type * as classification_mutations from "../classification/mutations.js";
import type * as classification_normalize from "../classification/normalize.js";
import type * as classification_openai from "../classification/openai.js";
import type * as classification_queries from "../classification/queries.js";
import type * as classification_signals from "../classification/signals.js";
import type * as classification_stale from "../classification/stale.js";
import type * as crons from "../crons.js";
import type * as devSeed from "../devSeed.js";
import type * as devSeedFixtures from "../devSeedFixtures.js";
import type * as devSeedWrites from "../devSeedWrites.js";
import type * as embedding_actions from "../embedding/actions.js";
import type * as embedding_internal from "../embedding/internal.js";
import type * as embedding_queries from "../embedding/queries.js";
import type * as embedding_search from "../embedding/search.js";
import type * as embedding_stale from "../embedding/stale.js";
import type * as embedding_storage from "../embedding/storage.js";
import type * as embedding_validators from "../embedding/validators.js";
import type * as http from "../http.js";
import type * as limiter from "../limiter.js";
import type * as mail_helpers from "../mail/helpers.js";
import type * as mail_mutations from "../mail/mutations.js";
import type * as mail_queries from "../mail/queries.js";
import type * as mail_types from "../mail/types.js";
import type * as mail_validators from "../mail/validators.js";
import type * as providers_crypto from "../providers/crypto.js";
import type * as providers_env from "../providers/env.js";
import type * as providers_gmail_api from "../providers/gmail/api.js";
import type * as providers_gmail_http from "../providers/gmail/http.js";
import type * as providers_gmail_oauth from "../providers/gmail/oauth.js";
import type * as providers_gmail_tokenAccess from "../providers/gmail/tokenAccess.js";
import type * as providers_microsoft_api from "../providers/microsoft/api.js";
import type * as providers_microsoft_http from "../providers/microsoft/http.js";
import type * as providers_microsoft_oauth from "../providers/microsoft/oauth.js";
import type * as providers_microsoft_tokenAccess from "../providers/microsoft/tokenAccess.js";
import type * as providers_types from "../providers/types.js";
import type * as sync_gmailOutbox from "../sync/gmailOutbox.js";
import type * as sync_internal from "../sync/internal.js";
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
  "attachments/actions": typeof attachments_actions;
  "attachments/constants": typeof attachments_constants;
  "attachments/internal": typeof attachments_internal;
  "attachments/mutations": typeof attachments_mutations;
  auth: typeof auth;
  "classification/actions": typeof classification_actions;
  "classification/constants": typeof classification_constants;
  "classification/env": typeof classification_env;
  "classification/internal": typeof classification_internal;
  "classification/jobHelpers": typeof classification_jobHelpers;
  "classification/mutations": typeof classification_mutations;
  "classification/normalize": typeof classification_normalize;
  "classification/openai": typeof classification_openai;
  "classification/queries": typeof classification_queries;
  "classification/signals": typeof classification_signals;
  "classification/stale": typeof classification_stale;
  crons: typeof crons;
  devSeed: typeof devSeed;
  devSeedFixtures: typeof devSeedFixtures;
  devSeedWrites: typeof devSeedWrites;
  "embedding/actions": typeof embedding_actions;
  "embedding/internal": typeof embedding_internal;
  "embedding/queries": typeof embedding_queries;
  "embedding/search": typeof embedding_search;
  "embedding/stale": typeof embedding_stale;
  "embedding/storage": typeof embedding_storage;
  "embedding/validators": typeof embedding_validators;
  http: typeof http;
  limiter: typeof limiter;
  "mail/helpers": typeof mail_helpers;
  "mail/mutations": typeof mail_mutations;
  "mail/queries": typeof mail_queries;
  "mail/types": typeof mail_types;
  "mail/validators": typeof mail_validators;
  "providers/crypto": typeof providers_crypto;
  "providers/env": typeof providers_env;
  "providers/gmail/api": typeof providers_gmail_api;
  "providers/gmail/http": typeof providers_gmail_http;
  "providers/gmail/oauth": typeof providers_gmail_oauth;
  "providers/gmail/tokenAccess": typeof providers_gmail_tokenAccess;
  "providers/microsoft/api": typeof providers_microsoft_api;
  "providers/microsoft/http": typeof providers_microsoft_http;
  "providers/microsoft/oauth": typeof providers_microsoft_oauth;
  "providers/microsoft/tokenAccess": typeof providers_microsoft_tokenAccess;
  "providers/types": typeof providers_types;
  "sync/gmailOutbox": typeof sync_gmailOutbox;
  "sync/internal": typeof sync_internal;
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
