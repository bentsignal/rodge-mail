import { createEnv } from "convex-env";
import { betterAuth, environment } from "convex-env/presets";
import { v } from "convex/values";

export const env = createEnv({
  ...environment,
  ...betterAuth,
  PASSKEY_RP_ID: v.string(),
});
