import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { z } from "zod";

import {
  getPasskeyRemovalBlock,
  getPasskeySignIn,
} from "@rodge-mail/std/passkey-sign-in";

import { passkeyRpIdSchema } from "./betterAuth/passkeyRpIdPlugin";

export interface PasskeyRpIds {
  app: string;
  website: string;
}

interface StoredPasskey {
  credentialID: string;
  id: string;
  rpId?: string | null;
  userId: string;
}

interface PasskeyAdapter {
  findMany: <T>(query: {
    model: string;
    where: { field: string; value: string }[];
  }) => Promise<T[]>;
  findOne: <T>(query: {
    model: string;
    where: { field: string; value: string }[];
  }) => Promise<T | null>;
  update: <T>(query: {
    model: string;
    update: Record<string, unknown>;
    where: { field: string; value: string }[];
  }) => Promise<T | null>;
}

const credentialBodySchema = z.object({
  response: z.object({ id: z.string().min(1) }),
});
const deleteBodySchema = z.object({ id: z.string().min(1) });

/**
 * Records which relying party each passkey belongs to, and refuses to delete
 * a platform's last passkey. A passkey's rpId is set when it's registered,
 * and on every sign-in it verifies, since the signature proves the relying
 * party. Passkeys stored before this have none until they next sign in.
 */
export function passkeyRpIds(options: { rpId: string; rpIds: PasskeyRpIds }) {
  return {
    id: "passkey-rp-ids",
    schema: passkeyRpIdSchema,
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/passkey/delete-passkey",
          handler: createAuthMiddleware(async (ctx) => {
            const body = deleteBodySchema.safeParse(ctx.body);
            if (!body.success) return;
            // The endpoint checks the session and ownership after this hook.
            const block = await findPasskeyRemovalBlock(
              ctx.context.adapter,
              body.data.id,
              options.rpIds,
            );
            if (block) throw new APIError("BAD_REQUEST", { message: block });
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) =>
            ctx.path === "/passkey/verify-registration" ||
            ctx.path === "/passkey/verify-authentication",
          handler: createAuthMiddleware(async (ctx) => {
            if (isAPIError(ctx.context.returned)) return;
            const body = credentialBodySchema.safeParse(ctx.body);
            if (!body.success) return;
            // The passkey already worked; a failed write mustn't undo that.
            await recordPasskeyRpId(
              ctx.context.adapter,
              body.data.response.id,
              options.rpId,
            ).catch((error: unknown) => {
              ctx.context.logger.error("Couldn't record a passkey's rpId", error);
            });
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}

export async function findPasskeyRemovalBlock(
  adapter: PasskeyAdapter,
  id: string,
  rpIds: PasskeyRpIds,
) {
  const target = await adapter.findOne<StoredPasskey>({
    model: "passkey",
    where: [{ field: "id", value: id }],
  });
  if (!target) return undefined;
  const passkeys = await adapter.findMany<StoredPasskey>({
    model: "passkey",
    where: [{ field: "userId", value: target.userId }],
  });
  return getPasskeyRemovalBlock(
    passkeys.map((passkey) => ({
      id: passkey.id,
      signsInTo: getPasskeySignIn(passkey.rpId, rpIds),
    })),
    id,
  );
}

export async function recordPasskeyRpId(
  adapter: PasskeyAdapter,
  credentialID: string,
  rpId: string,
) {
  const passkey = await adapter.findOne<StoredPasskey>({
    model: "passkey",
    where: [{ field: "credentialID", value: credentialID }],
  });
  if (!passkey || passkey.rpId === rpId) return;
  await adapter.update({
    model: "passkey",
    update: { rpId },
    where: [{ field: "id", value: passkey.id }],
  });
}
