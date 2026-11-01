import type { BetterAuthPlugin } from "better-auth";

export const passkeyRpIdSchema = {
  passkey: { fields: { rpId: { required: false, type: "string" } } },
} satisfies BetterAuthPlugin["schema"];

/** The schema half of `passkeyRpIds`, for the component's adapter. */
export const passkeyRpIdPlugin = {
  id: "passkey-rp-ids",
  schema: passkeyRpIdSchema,
} satisfies BetterAuthPlugin;
