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

export async function checkIdentity(ctx: QueryCtx | MutationCtx | ActionCtx) {
  const user = await ctx.auth.getUserIdentity();
  if (!user) {
    throw new ConvexError("Unauthenticated");
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
