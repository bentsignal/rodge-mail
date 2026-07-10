import { createEnv } from "convex-env";
import { betterAuth, environment } from "convex-env/presets";
import { v } from "convex/values";

export const env = createEnv({
  ...environment,
  ...betterAuth,
  OWNER_EMAIL: v.string(),
  OWNER_NAME: v.string(),
  OWNER_BOOTSTRAP_TOKEN: v.optional(v.string()),
  PASSKEY_RP_ID: v.string(),
});
