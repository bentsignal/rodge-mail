import type { CustomCtx } from "convex-helpers/server/customFunctions";
import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { ConvexError } from "convex/values";

import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import { action, mutation, query } from "./_generated/server";
import { isAllowedUser } from "./authAccess";
import { env } from "./convex.env";

export async function checkIdentity(
  ctx: Pick<QueryCtx | MutationCtx | ActionCtx, "auth">,
) {
  const user = await ctx.auth.getUserIdentity();
  if (!user) {
    throw new ConvexError("Unauthenticated");
  }
  if (!isAllowedUser(user.subject, env.AUTH_ALLOWED_USER_ID)) {
    throw new ConvexError("Access denied");
  }
  return user;
}

export const authedMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const user = await checkIdentity(ctx);
    return { ownerId: user.subject, user };
  }),
);

export const authedQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const user = await checkIdentity(ctx);
    return { ownerId: user.subject, user };
  }),
);

export const authedAction = customAction(
  action,
  customCtx(async (ctx) => {
    const user = await checkIdentity(ctx);
    return { ownerId: user.subject, user };
  }),
);

type AuthedQueryCtx = CustomCtx<typeof authedQuery>;
type AuthedMutationCtx = CustomCtx<typeof authedMutation>;
type AuthedActionCtx = CustomCtx<typeof authedAction>;

export type { AuthedActionCtx, AuthedMutationCtx, AuthedQueryCtx };
