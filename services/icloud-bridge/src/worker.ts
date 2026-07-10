import type { BridgeJob } from "@rodge-mail/convex/providers/icloud/contract";

import type { BridgeAccount } from "./database";
import { claimBridgeJobs } from "./convex-client";
import { listAccounts } from "./database";
import { env } from "./env";
import { deliverMessage } from "./send";
import { synchronizeAccount } from "./sync";

let timer: NodeJS.Timeout | undefined;
let running = false;

export function startWorker() {
  void poll();
  timer = setInterval(() => void poll(), env.POLL_INTERVAL_MS);
}

export function stopWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

async function poll() {
  if (running) return;
  running = true;
  try {
    const accounts = await listAccounts();
    for (const account of accounts) await processAccount(account);
  } catch (error) {
    logError("worker poll failed", error);
  }
  running = false;
}

async function processAccount(account: BridgeAccount) {
  try {
    const jobs = await claimBridgeJobs(account.bridgeAccountId);
    for (const job of jobs) await processJob(account, job);
  } catch (error) {
    logError(`account ${account.bridgeAccountId} failed`, error);
  }
}

async function processJob(account: BridgeAccount, job: BridgeJob) {
  if (job.kind === "sync") {
    await synchronizeAccount(account, job);
    return;
  }
  await deliverMessage(account, job);
}

function logError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`[icloud-bridge] ${context}: ${message}`);
}
