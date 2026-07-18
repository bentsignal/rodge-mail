import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import type {
  GetThreadOutput,
  ListAccountsOutput,
  SearchMailOutput,
} from "@rodge-mail/agent-contract";

import type { CliUrls } from "./config.ts";
import { authenticatedSession } from "./auth.ts";

interface MailPageArgs extends Record<string, unknown> {
  accountId?: string;
  cursor?: string;
  limit?: number;
}

const LIST_ACCOUNTS = makeFunctionReference<
  "action",
  Record<string, never>,
  ListAccountsOutput
>("cli/commands:listAccounts");
const LIST_MAIL = makeFunctionReference<
  "action",
  MailPageArgs,
  SearchMailOutput | null
>("cli/commands:listMail");
const SEARCH_MAIL = makeFunctionReference<
  "action",
  MailPageArgs & { query: string },
  SearchMailOutput | null
>("cli/commands:searchMail");
const GET_THREAD = makeFunctionReference<
  "action",
  { threadId: string },
  GetThreadOutput | null
>("cli/commands:getThread");

export async function createMailClient(urls: CliUrls) {
  const { token } = await authenticatedSession(urls);
  const client = new ConvexHttpClient(urls.convexCloud);
  client.setAuth(token);
  return {
    getThread: async (threadId: string) =>
      await client.action(GET_THREAD, { threadId }),
    listAccounts: async () => await client.action(LIST_ACCOUNTS, {}),
    listMail: async (args: MailPageArgs) =>
      await client.action(LIST_MAIL, args),
    searchMail: async (query: string, args: MailPageArgs) =>
      await client.action(SEARCH_MAIL, { ...args, query }),
  };
}
