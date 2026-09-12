import { createEnv } from "convex-env";
import { betterAuth, environment } from "convex-env/presets";
import { v } from "convex/values";

export const env = createEnv({
  ...environment,
  ...betterAuth,
  AUTH_EMAIL_FROM: v.string(),
  AUTH_ALLOWED_USER_ID: v.string(),
  WEB_URL: v.optional(v.string()),
  DESKTOP_BROWSER_AUTH_URL: v.optional(v.string()),
  PASSKEY_RP_ID: v.string(),
  RESEND_API_KEY: v.string(),
});
