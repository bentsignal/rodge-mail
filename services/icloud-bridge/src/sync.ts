import type { ListResponse } from "imapflow";

import type { NormalizedICloudMessage } from "@rodge-mail/convex/providers/icloud/contract";

import type { BridgeAccount, MessageState } from "./database";
import { postSyncBatch } from "./convex-client";
import { decryptCredential } from "./credentials";
import { listMessageStates, replaceMailboxState } from "./database";
import { env } from "./env";
import { createImapClient, safeLogout } from "./icloud-client";
import {
  isSelectableMailbox,
  normalizeMessage,
  toNormalizedFolder,
} from "./normalize";

const MAX_BATCH_BYTES = 700_000;

export async function synchronizeAccount(
  account: BridgeAccount,
  job: {
    jobId: string;
    leaseId: string;
    reason: "initial" | "incremental" | "manual" | "reconcile";
  },
) {
  const password = decryptCredential(
    account.encryptedCredential,
    account.bridgeAccountId,
  );
  const client = createImapClient({
    username: account.imapUsername,
    password,
  });
  const stateUpdates = new Array<{ mailbox: string; states: MessageState[] }>();
  const deletedRemoteMessageIds = new Array<string>();
  try {
    await client.connect();
    const mailboxes = (await client.list()).filter(isSelectableMailbox);
    for (const mailbox of mailboxes) {
      const result = await synchronizeMailbox(client, account, mailbox);
      stateUpdates.push({ mailbox: mailbox.path, states: result.states });
      deletedRemoteMessageIds.push(...result.deletedRemoteMessageIds);
      for (const messages of chunkMessages(result.messages)) {
        await postSyncBatch({
          bridgeAccountId: account.bridgeAccountId,
          jobId: job.jobId,
          leaseId: job.leaseId,
          messages,
          complete: false,
        });
      }
    }
    const cursor = JSON.stringify({
      version: 1,
      completedAt: Date.now(),
      mailboxCount: stateUpdates.length,
    });
    await postSyncBatch({
      bridgeAccountId: account.bridgeAccountId,
      jobId: job.jobId,
      leaseId: job.leaseId,
      cursor,
      folders: mailboxes.map(toNormalizedFolder),
      deletedRemoteMessageIds,
      complete: true,
    });
    for (const update of stateUpdates) {
      await replaceMailboxState(
        account.bridgeAccountId,
        update.mailbox,
        update.states,
      );
    }
  } catch (error) {
    await postSyncFailure(account.bridgeAccountId, job, error);
    throw error;
  } finally {
    await safeLogout(client);
  }
}

async function synchronizeMailbox(
  client: ReturnType<typeof createImapClient>,
  account: BridgeAccount,
  mailbox: ListResponse,
) {
  const opened = await client.mailboxOpen(mailbox.path, { readOnly: true });
  const uidValidity = opened.uidValidity.toString();
  const searchResult = await client.search({ all: true }, { uid: true });
  const currentUids = searchResult === false ? [] : searchResult;
  const previous = await listMessageStates(
    account.bridgeAccountId,
    mailbox.path,
  );
  const sameGeneration = previous.filter(
    (state) => state.uidValidity === uidValidity,
  );
  const knownUids = new Set(sameGeneration.map((state) => state.uid));
  const currentUidSet = new Set(currentUids);
  const newUids = currentUids.filter((uid) => !knownUids.has(uid));
  const deletedRemoteMessageIds = previous
    .filter(
      (state) =>
        state.uidValidity !== uidValidity || !currentUidSet.has(state.uid),
    )
    .map((state) => state.remoteMessageId);
  const messages = new Array<NormalizedICloudMessage>();
  const newStates = new Array<MessageState>();
  for (const uidChunk of chunk(newUids, env.SYNC_BATCH_SIZE)) {
    for await (const message of client.fetch(
      uidChunk,
      {
        uid: true,
        flags: true,
        envelope: true,
        internalDate: true,
        size: true,
        source: { maxLength: env.MAX_MESSAGE_BYTES },
      },
      { uid: true },
    )) {
      const normalized = await normalizeMessage(
        account,
        mailbox,
        uidValidity,
        message,
      );
      messages.push(normalized);
      newStates.push({
        uid: message.uid,
        uidValidity,
        remoteMessageId: normalized.remoteMessageId,
      });
    }
  }
  return {
    messages,
    deletedRemoteMessageIds,
    states: [
      ...sameGeneration.filter((state) => currentUidSet.has(state.uid)),
      ...newStates,
    ],
  };
}

async function postSyncFailure(
  bridgeAccountId: string,
  job: { jobId: string; leaseId: string },
  error: unknown,
) {
  const message = error instanceof Error ? error.message : "iCloud sync failed";
  const authenticationFailure = /auth|credential|login|password/iu.test(
    message,
  );
  try {
    await postSyncBatch({
      bridgeAccountId,
      jobId: job.jobId,
      leaseId: job.leaseId,
      complete: true,
      error:
        `${authenticationFailure ? "AUTHENTICATION_FAILED:" : "SYNC_FAILED:"}${message}`.slice(
          0,
          500,
        ),
    });
  } catch {
    // The lease expires and is safely reclaimed when Convex is unavailable.
  }
}

function chunk<T>(values: T[], size: number) {
  const chunks = new Array<T[]>();
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function chunkMessages(messages: NormalizedICloudMessage[]) {
  const batches = new Array<NormalizedICloudMessage[]>();
  let batch = new Array<NormalizedICloudMessage>();
  let batchBytes = 0;
  for (const message of messages) {
    const bytes = Buffer.byteLength(JSON.stringify(message));
    if (
      batch.length > 0 &&
      (batch.length >= env.SYNC_BATCH_SIZE ||
        batchBytes + bytes > MAX_BATCH_BYTES)
    ) {
      batches.push(batch);
      batch = new Array<NormalizedICloudMessage>();
      batchBytes = 0;
    }
    batch.push(message);
    batchBytes += bytes;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}
