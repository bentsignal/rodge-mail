import { useLayoutEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

import { useMailStore } from "~/features/mail/store";

export const Route = createFileRoute("/_authed/archive/messages/$messageId")({
  loader: async ({ context, params }) => {
    const messageId = toMessageId(params.messageId);
    const message = await context.queryClient.ensureQueryData(
      convexQuery(api.mail.queries.getMessage, { messageId }),
    );
    await context.queryClient.ensureQueryData(
      convexQuery(api.mail.queries.getThread, { threadId: message.threadId }),
    );
    return { messageId, threadId: message.threadId };
  },
  component: ArchivedMessagePage,
});

function ArchivedMessagePage() {
  const messageId = Route.useLoaderData({
    select: (data) => data.messageId,
  });
  const threadId = Route.useLoaderData({
    select: (data) => data.threadId,
  });
  const selectThread = useMailStore((store) => store.selectThread);

  useLayoutEffect(
    () => selectThread({ messageId, threadId }),
    [messageId, selectThread, threadId],
  );
  return null;
}

function toMessageId(value: string) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Convex validates the route-derived ID at the query boundary.
  return value as Id<"messages">;
}
