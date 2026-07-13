import assert from "node:assert/strict";
import test from "node:test";

import { waitForWebAppReady } from "./web-readiness.ts";

const webAppUrl = new URL("https://www.rodge-mail.local");

void test("waits through transient startup failures", async () => {
  let now = 0;
  const outcomes = [new Error("name not resolved"), 502, 200];

  await waitForWebAppReady(
    webAppUrl,
    () => {
      const outcome = outcomes.shift();
      if (outcome instanceof Error) throw outcome;
      return Promise.resolve(outcome ?? 500);
    },
    {
      now: () => now,
      retryIntervalMs: 10,
      sleep: (durationMs) => {
        now += durationMs;
        return Promise.resolve();
      },
      timeoutMs: 100,
    },
  );

  assert.equal(outcomes.length, 0);
});

void test("reports the last response when readiness times out", async () => {
  let now = 0;

  await assert.rejects(
    waitForWebAppReady(webAppUrl, () => Promise.resolve(502), {
      now: () => now,
      retryIntervalMs: 10,
      sleep: (durationMs) => {
        now += durationMs;
        return Promise.resolve();
      },
      timeoutMs: 25,
    }),
    /did not become ready within 25ms \(HTTP 502\)/,
  );
});
