/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts_queries from "../accounts/queries.js";
import type * as auth from "../auth.js";
import type * as classification_internal from "../classification/internal.js";
import type * as classification_queries from "../classification/queries.js";
import type * as devSeed from "../devSeed.js";
import type * as devSeedFixtures from "../devSeedFixtures.js";
import type * as devSeedWrites from "../devSeedWrites.js";
import type * as http from "../http.js";
import type * as limiter from "../limiter.js";
import type * as mail_helpers from "../mail/helpers.js";
import type * as mail_mutations from "../mail/mutations.js";
import type * as mail_queries from "../mail/queries.js";
import type * as mail_types from "../mail/types.js";
import type * as mail_validators from "../mail/validators.js";
import type * as sync_internal from "../sync/internal.js";
import type * as urls from "../urls.js";
import type * as utils from "../utils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "accounts/queries": typeof accounts_queries;
  auth: typeof auth;
  "classification/internal": typeof classification_internal;
  "classification/queries": typeof classification_queries;
  devSeed: typeof devSeed;
  devSeedFixtures: typeof devSeedFixtures;
  devSeedWrites: typeof devSeedWrites;
  http: typeof http;
  limiter: typeof limiter;
  "mail/helpers": typeof mail_helpers;
  "mail/mutations": typeof mail_mutations;
  "mail/queries": typeof mail_queries;
  "mail/types": typeof mail_types;
  "mail/validators": typeof mail_validators;
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
