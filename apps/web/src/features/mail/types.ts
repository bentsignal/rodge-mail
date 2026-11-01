import type { FunctionReturnType } from "convex/server";

import type { api } from "@rodge-mail/convex/api";

export type MailAccountDocument = FunctionReturnType<
  typeof api.accounts.queries.list
>[number];

export type InboxMessage = FunctionReturnType<
  typeof api.mail.queries.listInbox
>["page"][number];

export type MailThreadDetail = NonNullable<
  FunctionReturnType<typeof api.mail.queries.getThread>
>;

export type ThreadMessageDetail = MailThreadDetail["messages"][number];

export interface MailAccountView extends MailAccountDocument {
  initials: string;
  label: string;
}
