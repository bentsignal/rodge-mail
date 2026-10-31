import { useLayoutEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

import { useMailStore } from "~/features/mail/store";

export const Route = createFileRoute("/_authed/sent/$outboxId")({
  loader: async ({ context, params }) => {
    const message = await context.queryClient.ensureQueryData(
      convexQuery(api.outbox.queries.getSentMessage, {
        outboxId: toOutboxId(params.outboxId),
      }),
    );
    if (!message?.messageId || !message.threadId) return {};
    await context.queryClient.ensureQueryData(
      convexQuery(api.mail.queries.getThread, { threadId: message.threadId }),
    );
    return { messageId: message.messageId, threadId: message.threadId };
  },
  component: SentMessagePage,
});

function SentMessagePage() {
  const messageId = Route.useLoaderData({
    select: (data) => data.messageId,
  });
  const threadId = Route.useLoaderData({
    select: (data) => data.threadId,
  });
  const selectThread = useMailStore((store) => store.selectThread);

  useLayoutEffect(() => {
    if (messageId && threadId) selectThread({ messageId, threadId });
  }, [messageId, selectThread, threadId]);
  return null;
}

function toOutboxId(value: string) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Convex validates the route-derived ID at the query boundary.
  return value as Id<"outboxMessages">;
}
