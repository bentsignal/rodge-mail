import { passkey } from "@better-auth/passkey";
import { memoryAdapter } from "better-auth/adapters/memory";
import { betterAuth } from "better-auth/minimal";
import { describe, expect, it } from "vitest";

import { passkeyRpIds, recordPasskeyRpId } from "./passkeyRpIds";

const rpIds = {
  app: "fake-deployment.convex.site",
  website: "mail.example.com",
};

async function createAuth(rpIdsByPasskey: Record<string, string | undefined>) {
  const db = Object.fromEntries(
    ["account", "passkey", "session", "user", "verification"].map((model) => [
      model,
      [],
    ]),
  );
  const auth = betterAuth({
    baseURL: "http://localhost:3000",
    database: memoryAdapter(db),
    logger: { disabled: true },
    plugins: [
      passkey({ rpID: rpIds.website }),
      passkeyRpIds({ rpId: rpIds.website, rpIds }),
    ],
    secret: "test-secret-that-is-long-enough-to-use",
  });
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser({
    email: "alex.rivera@example.com",
    emailVerified: true,
    name: "Alex Rivera",
  });
  for (const [id, rpId] of Object.entries(rpIdsByPasskey)) {
    await context.adapter.create({
      forceAllowId: true,
      model: "passkey",
      data: {
        backedUp: true,
        counter: 0,
        credentialID: `credential-${id}`,
        deviceType: "multiDevice",
        id,
        publicKey: "key",
        rpId,
        userId: user.id,
      },
    });
  }
  return { auth, context, db };
}

async function deletePasskeyError(
  auth: Awaited<ReturnType<typeof createAuth>>["auth"],
  id: string,
) {
  try {
    await auth.api.deletePasskey({ body: { id }, headers: new Headers() });
  } catch (error) {
    if (error instanceof Error) return error.message;
  }
  throw new Error("Expected the delete to be refused");
}

describe("passkeyRpIds", () => {
  it("refuses to delete a platform's last passkey before the session check", async () => {
    const { auth } = await createAuth({
      phone: rpIds.app,
      laptop: rpIds.website,
      older: undefined,
    });

    await expect(deletePasskeyError(auth, "phone")).resolves.toBe(
      "This is your only passkey for the iPhone app.",
    );
    await expect(deletePasskeyError(auth, "laptop")).resolves.toBe(
      "This is your only passkey for the website.",
    );
  });

  it("leaves allowed deletes to the passkey endpoint", async () => {
    const { auth } = await createAuth({
      desktop: rpIds.website,
      laptop: rpIds.website,
      phone: rpIds.app,
      stale: "old.example.com",
    });

    // Without a session the endpoint itself refuses, after the guard passed.
    await expect(deletePasskeyError(auth, "laptop")).resolves.toBe(
      "Unauthorized",
    );
    await expect(deletePasskeyError(auth, "stale")).resolves.toBe(
      "Unauthorized",
    );
  });

  it("records the relying party on a passkey that has none", async () => {
    const { context, db } = await createAuth({ older: undefined });

    await recordPasskeyRpId(context.adapter, "credential-older", rpIds.app);
    await recordPasskeyRpId(context.adapter, "credential-missing", rpIds.app);

    expect(db.passkey).toEqual([
      expect.objectContaining({ id: "older", rpId: rpIds.app }),
    ]);
  });
});
