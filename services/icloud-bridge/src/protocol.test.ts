import assert from "node:assert/strict";
import test from "node:test";

import {
  signBridgeRequest,
  signSetupToken,
  verifyBridgeRequestSignature,
  verifySetupToken,
} from "@rodge-mail/convex/providers/icloud/protocol";

const secret = "a-test-secret-that-is-longer-than-thirty-two-characters";

void test("setup tokens are signed, expire, and reject tampering", async () => {
  const payload = {
    version: 1 as const,
    challengeId: "a".repeat(43),
    ownerId: "owner_1",
    returnPath: "/settings/accounts",
    expiresAt: Date.now() + 60_000,
  };
  const token = await signSetupToken(payload, secret);
  assert.deepEqual(await verifySetupToken(token, secret), payload);
  assert.equal(await verifySetupToken(`${token}x`, secret), null);

  const expired = await signSetupToken(
    { ...payload, expiresAt: Date.now() - 1 },
    secret,
  );
  assert.equal(await verifySetupToken(expired, secret), null);
});

void test("request signatures bind method, path, body, request ID, and timestamp", async () => {
  const input = {
    timestamp: Date.now().toString(),
    requestId: "request-12345678901234567890",
    method: "POST",
    pathname: "/providers/icloud/bridge/jobs/claim",
    body: '{"bridgeAccountId":"account"}',
  };
  const signature = await signBridgeRequest(input, secret);
  assert.equal(
    await verifyBridgeRequestSignature({ ...input, signature }, secret),
    true,
  );
  assert.equal(
    await verifyBridgeRequestSignature(
      { ...input, body: `${input.body} `, signature },
      secret,
    ),
    false,
  );
  assert.equal(
    await verifyBridgeRequestSignature(
      { ...input, timestamp: "1", signature, now: Date.now() },
      secret,
    ),
    false,
  );
});
