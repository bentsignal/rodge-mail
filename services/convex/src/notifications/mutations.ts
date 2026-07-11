import { ConvexError, v } from "convex/values";

import { authedMutation } from "../utils";
import { isExpoPushToken } from "./payload";
import { vPushPlatform } from "./validators";

export const registerPushToken = authedMutation({
  args: {
    token: v.string(),
    deviceId: v.string(),
    platform: vPushPlatform,
  },
  handler: async (ctx, args) => {
    if (!isExpoPushToken(args.token) || args.deviceId.length > 200) {
      throw new ConvexError("Invalid Expo push token registration");
    }
    const existing = await ctx.db
      .query("mobilePushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    const now = Date.now();
    const values = {
      ownerId: ctx.ownerId,
      deviceId: args.deviceId,
      platform: args.platform,
      enabled: true,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, values);
      return existing._id;
    }
    return await ctx.db.insert("mobilePushTokens", {
      token: args.token,
      ...values,
      createdAt: now,
    });
  },
});

export const unregisterPushToken = authedMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mobilePushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!existing || existing.ownerId !== ctx.ownerId) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const setPreferences = authedMutation({
  args: {
    newMailEnabled: v.boolean(),
    includePreview: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.ownerId))
      .unique();
    const now = Date.now();
    const values = { ...args, updatedAt: now };
    if (existing) {
      await ctx.db.patch(existing._id, values);
      return existing._id;
    }
    return await ctx.db.insert("notificationPreferences", {
      ownerId: ctx.ownerId,
      ...values,
      createdAt: now,
    });
  },
});
