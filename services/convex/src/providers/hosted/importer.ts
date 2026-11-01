"use node";

import { createHash } from "node:crypto";
import { inspect } from "node:util";
import type { ParsedMail } from "mailparser";
import { ConvexError, v } from "convex/values";

import type { Doc } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import type {
  ImportFolder,
  ImportSourceMessage,
  MailImportSource,
  NormalizedMessage,
} from "../types";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { toWellFormed, truncateText } from "../../mail/text";
import { MicrosoftGraphError } from "../microsoft/api";
import { MicrosoftMailImportSource } from "../microsoft/mailImport";
import { getUsableMicrosoftTokens } from "../microsoft/tokenAccess";
import { hostedObjectKey, importedRemoteMessageId } from "./addresses";
import { putRawMessage } from "./aws";
import { normalizeHostedMessage, parseRawMessage } from "./normalize";

export const IMPORT_BATCH_SIZE = 25;
export const MAX_IMPORT_MESSAGE_BYTES = 40 * 1024 * 1024;

export interface ImportBatchDeps {
  source: MailImportSource;
  putRawMessage(key: string, raw: Uint8Array): Promise<void>;
  findImported(remoteMessageIds: string[]): Promise<string[]>;
  ingest(
    message: NormalizedMessage,
  ): Promise<"imported" | "skipped" | "duplicate">;
}

interface ImportFailure {
  remoteMessageId: string;
  folder: string;
  reason: string;
  at: number;
  subject?: string;
  from?: string;
  receivedAt?: number;
}

export interface ImportBatchJob {
  cursor?: string;
  sourceAccountId: string;
  targetAccountId: string;
  targetAddress: string;
}

export const run = internalAction({
  args: { importId: v.id("mailImports"), runId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const context = await ctx.runQuery(
      internal.providers.hosted.importJobs.getRunContext,
      args,
    );
    if (!context) return;
    const { job, target } = context;
    let result: Awaited<ReturnType<typeof importBatch>>;
    try {
      result = await importBatch(
        {
          cursor: job.cursor,
          sourceAccountId: job.sourceAccountId,
          targetAccountId: target._id,
          targetAddress: target.address,
        },
        {
          source: await createImportSource(ctx, context),
          putRawMessage,
          findImported: async (remoteMessageIds) =>
            await ctx.runQuery(
              internal.providers.hosted.importMessages.findImported,
              { targetAccountId: target._id, remoteMessageIds },
            ),
          ingest: async (message) =>
            await ctx.runMutation(
              internal.providers.hosted.importMessages.ingestMessage,
              { ownerId: job.ownerId, targetAccountId: target._id, message },
            ),
        },
      );
    } catch (error) {
      result = { ...emptyTally(), error: describeError(error) };
    }
    await ctx.runMutation(internal.providers.hosted.importJobs.finishBatch, {
      ...args,
      ...result,
    });
  },
});

export async function importBatch(job: ImportBatchJob, deps: ImportBatchDeps) {
  const tally = emptyTally();
  let page: Awaited<ReturnType<MailImportSource["listMessages"]>>;
  try {
    page = await deps.source.listMessages(job.cursor, IMPORT_BATCH_SIZE);
  } catch (error) {
    return { ...tally, error: describeError(error) };
  }
  const remoteMessageIds = page.messages.map((message) =>
    importedRemoteMessageId(
      importDigest(job.sourceAccountId, message.remoteMessageId),
    ),
  );
  const known = new Set(await deps.findImported(remoteMessageIds));
  for (const [index, message] of page.messages.entries()) {
    const remoteMessageId = remoteMessageIds[index] ?? "";
    if (known.has(remoteMessageId)) {
      tally.skipped += 1;
      continue;
    }
    try {
      const outcome = await importMessage(job, deps, message, remoteMessageId);
      if (outcome !== "imported") {
        tally.skipped += 1;
      } else {
        tally.imported += 1;
        if (message.folder.kind === "inbox") tally.inboxImported += 1;
      }
    } catch (error) {
      if (isTransientError(error)) {
        return { ...tally, error: describeError(error) };
      }
      tally.failures.push(importFailure(message, error));
    }
  }
  return {
    ...tally,
    nextCursor: page.nextCursor,
    estimatedTotal: page.estimatedTotal,
    currentFolder: page.messages.at(-1)?.folder.path,
  };
}

function importFailure(message: ImportSourceMessage, error: unknown) {
  return {
    remoteMessageId: message.remoteMessageId,
    folder: message.folder.path,
    reason: describeError(error),
    at: Date.now(),
    subject: message.subject && clip(message.subject, 200),
    from: message.from && clip(message.from, 200),
    receivedAt: message.receivedAt,
  } satisfies ImportFailure;
}

export function importDigest(sourceAccountId: string, remoteMessageId: string) {
  return createHash("sha256")
    .update(`${sourceAccountId}:${remoteMessageId}`)
    .digest("hex");
}

export function importPlacement(folder: ImportFolder, isRead: boolean) {
  const incoming = {
    direction: "incoming" as const,
    inInbox: false,
    isRead,
    junk: false,
  };
  switch (folder.kind) {
    case "inbox":
      return { ...incoming, inInbox: true, labelIds: ["inbox"] };
    case "sent":
      return {
        ...incoming,
        direction: "outgoing" as const,
        isRead: true,
        labelIds: ["sent"],
      };
    case "archive":
      return { ...incoming, labelIds: ["archive"] };
    case "junk":
      return { ...incoming, junk: true, labelIds: ["junk"] };
    case "custom":
      return { ...incoming, labelIds: [`folder:${folder.path}`] };
  }
}

export function normalizeImportedMessage(
  parsed: ParsedMail,
  args: {
    remoteMessageId: string;
    message: ImportSourceMessage;
    targetAddress: string;
  },
) {
  const placement = importPlacement(args.message.folder, args.message.isRead);
  return normalizeHostedMessage(parsed, {
    ...placement,
    remoteMessageId: args.remoteMessageId,
    fallbackFrom:
      placement.direction === "outgoing"
        ? args.targetAddress
        : "unknown@invalid",
    receivedAt: args.message.receivedAt ?? parsed.date?.getTime() ?? Date.now(),
  });
}

async function importMessage(
  job: ImportBatchJob,
  deps: ImportBatchDeps,
  message: ImportSourceMessage,
  remoteMessageId: string,
) {
  const raw = await deps.source.fetchRawMessage(message.remoteMessageId);
  if (raw.byteLength > MAX_IMPORT_MESSAGE_BYTES) {
    throw new Error(
      `The message is ${Math.ceil(raw.byteLength / 1024 / 1024)} MB, over the 40 MB import limit`,
    );
  }
  const normalized = normalizeImportedMessage(await parseRawMessage(raw), {
    remoteMessageId,
    message,
    targetAddress: job.targetAddress,
  });
  await deps.putRawMessage(
    hostedObjectKey({
      accountId: job.targetAccountId,
      remoteMessageId,
      direction: normalized.direction,
    }),
    raw,
  );
  return await deps.ingest(normalized);
}

async function createImportSource(
  ctx: ActionCtx,
  context: {
    source: Doc<"mailAccounts">;
    encryptedTokens?: Doc<"providerCredentials">["encryptedTokens"];
  },
) {
  const { source, encryptedTokens } = context;
  if (!encryptedTokens) {
    throw new Error(`${source.address} has no stored credentials`);
  }
  if (source.provider === "microsoft") {
    const tokens = await getUsableMicrosoftTokens(ctx, {
      ownerId: source.ownerId,
      accountId: source._id,
      encryptedTokens,
    });
    return new MicrosoftMailImportSource(tokens.accessToken);
  }
  throw new Error(`Importing from ${source.provider} is not supported yet`);
}

function emptyTally() {
  return {
    imported: 0,
    skipped: 0,
    inboxImported: 0,
    failures: new Array<ImportFailure>(),
  };
}

function isTransientError(error: unknown) {
  if (error instanceof MicrosoftGraphError) {
    return error.status === 429 || error.status >= 500;
  }
  return error instanceof TypeError && error.message === "fetch failed";
}

export function describeError(error: unknown) {
  const parts = new Array<string>();
  let current = error;
  for (let depth = 0; depth < 3 && current !== undefined; depth += 1) {
    if (!(current instanceof Error)) {
      parts.push(inspect(current));
      break;
    }
    const name = ["Error", "ConvexError"].includes(current.name)
      ? ""
      : `${current.name}: `;
    const data =
      current instanceof ConvexError && typeof current.data !== "string"
        ? ` (data: ${JSON.stringify(current.data)})`
        : "";
    parts.push(`${name}${current.message}${data}`);
    current = "cause" in current ? current.cause : undefined;
  }
  return clip(parts.join("; caused by "), 1_000);
}

function clip(value: string, maxLength: number) {
  return truncateText(toWellFormed(value), maxLength);
}
