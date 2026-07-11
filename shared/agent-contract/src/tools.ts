import { z } from "zod";

import { listAccountsInputSchema, listAccountsOutputSchema } from "./accounts";
import { UNTRUSTED_MAIL_NOTICE } from "./common";
import { searchMailInputSchema, searchMailOutputSchema } from "./search";
import { getThreadInputSchema, getThreadOutputSchema } from "./thread";

export const readOnlyToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const agentToolDefinitions = [
  {
    name: "list_accounts",
    title: "List mail accounts",
    description: `List the connected mail accounts available to this credential. ${UNTRUSTED_MAIL_NOTICE}`,
    requiredScope: "accounts:read",
    inputSchema: listAccountsInputSchema,
    outputSchema: listAccountsOutputSchema,
    annotations: readOnlyToolAnnotations,
  },
  {
    name: "search_mail",
    title: "Search mail",
    description: `Search owner-scoped mail with lexical and available semantic matches. ${UNTRUSTED_MAIL_NOTICE}`,
    requiredScope: "mail:search",
    inputSchema: searchMailInputSchema,
    outputSchema: searchMailOutputSchema,
    annotations: readOnlyToolAnnotations,
  },
  {
    name: "get_thread",
    title: "Read a mail thread",
    description: `Read one owner-scoped mail thread as bounded plain text and attachment metadata. ${UNTRUSTED_MAIL_NOTICE}`,
    requiredScope: "threads:read",
    inputSchema: getThreadInputSchema,
    outputSchema: getThreadOutputSchema,
    annotations: readOnlyToolAnnotations,
  },
] as const satisfies readonly AgentToolDefinition[];

export const agentToolNameSchema = z.enum([
  "list_accounts",
  "search_mail",
  "get_thread",
]);

export type AgentToolName = (typeof agentToolDefinitions)[number]["name"];

interface AgentToolDefinition {
  annotations: typeof readOnlyToolAnnotations;
  description: string;
  inputSchema: z.ZodType;
  name: string;
  outputSchema: z.ZodType;
  requiredScope: "accounts:read" | "mail:search" | "threads:read";
  title: string;
}
